import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createGameSave,
	createInitialGameState,
	type GameSaveEnvelope,
} from "@shared/game";
import type {
	GetGameSaveResponse,
	PutGameSaveRequest,
	PutGameSaveResponse,
	ServerGameSaveRecord,
} from "@shared/schemas/game-save.schema";
import { validateGameContentDirectory } from "../../../../scripts/validate-game-content";
import { ApiRequestError } from "../../api";
import {
	gameSaveStorageKey,
	LocalGameSaveRepository,
	type GameSaveStorage,
} from "./LocalGameSaveRepository";
import {
	pendingGameSaveStorageKey,
	ServerGameSaveRepository,
	type GameSaveRemote,
} from "./ServerGameSaveRepository";

const registry = validateGameContentDirectory();

class MemoryStorage implements GameSaveStorage {
	readonly values = new Map<string, string>();

	getItem(key: string): string | null {
		return this.values.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.values.set(key, value);
	}

	removeItem(key: string): void {
		this.values.delete(key);
	}
}

class MemoryRemote implements GameSaveRemote {
	record: ServerGameSaveRecord | null = null;
	available = true;
	loseNextSaveResponse = false;
	readonly requests: PutGameSaveRequest[] = [];
	private readonly operations = new Map<string, PutGameSaveResponse>();

	async load(): Promise<GetGameSaveResponse> {
		if (!this.available) throw new TypeError("network unavailable");
		return { save: this.record };
	}

	async save(request: PutGameSaveRequest): Promise<PutGameSaveResponse> {
		if (!this.available) throw new TypeError("network unavailable");
		this.requests.push(structuredClone(request));
		const replay = this.operations.get(request.idempotencyKey);
		if (replay) return replay;
		if ((this.record?.revision ?? null) !== request.expectedRevision) {
			throw new ApiRequestError(409, "revision conflict");
		}
		this.record = {
			revision: (this.record?.revision ?? 0) + 1,
			save: structuredClone(request.save),
			updatedAt: new Date().toISOString(),
		};
		const response = { save: this.record, idempotent: false };
		this.operations.set(request.idempotencyKey, response);
		if (this.loseNextSaveResponse) {
			this.loseNextSaveResponse = false;
			throw new TypeError("response lost");
		}
		return response;
	}
}

const stateAt = (checkpointId: string, revision: number) => {
	const state = createInitialGameState({ registry, rngSeed: revision + 1 });
	state.location.checkpointId = checkpointId;
	state.revision = revision;
	return state;
};

const record = (
	save: GameSaveEnvelope,
	revision: number,
): ServerGameSaveRecord => ({
	revision,
	save,
	updatedAt: "2026-08-11T00:00:00.000Z",
});

describe("ServerGameSaveRepository", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("saves to the account and loads it in a different browser", async () => {
		const remote = new MemoryRemote();
		const browserA = new ServerGameSaveRepository(
			new MemoryStorage(),
			"player@example.com",
			remote,
		);
		const saved = await browserA.save(
			stateAt("signal-core", 1),
			"2026-08-11T00:00:00.000Z",
		);
		expect(saved).toMatchObject({ ok: true, revision: 1, synced: true });

		const browserBStorage = new MemoryStorage();
		const browserB = new ServerGameSaveRepository(
			browserBStorage,
			"player@example.com",
			remote,
		);
		expect(await browserB.load()).toMatchObject({
			status: "ready",
			source: "server",
			save: { state: { location: { checkpointId: "signal-core" } } },
		});
		expect(
			browserBStorage.getItem(gameSaveStorageKey("player@example.com")),
		).not.toBeNull();
	});

	it("migrates a legacy browser-only checkpoint when the server slot is empty", async () => {
		const storage = new MemoryStorage();
		new LocalGameSaveRepository(storage, "player@example.com").save(
			stateAt("signal-core", 2),
			"2026-08-11T00:00:00.000Z",
		);
		const remote = new MemoryRemote();

		const result = await new ServerGameSaveRepository(
			storage,
			"player@example.com",
			remote,
		).load();

		expect(result).toMatchObject({
			status: "ready",
			source: "server",
			syncMessage: "The browser checkpoint was moved to your account.",
		});
		expect(remote.record?.revision).toBe(1);
	});

	it("treats an existing server checkpoint as authoritative", async () => {
		const storage = new MemoryStorage();
		new LocalGameSaveRepository(storage, "player@example.com").save(
			stateAt("local-checkpoint", 5),
		);
		const remote = new MemoryRemote();
		remote.record = record(
			createGameSave(
				stateAt("signal-core", 3),
				"2026-08-11T00:00:00.000Z",
			),
			4,
		);

		const result = await new ServerGameSaveRepository(
			storage,
			"player@example.com",
			remote,
		).load();

		expect(result).toMatchObject({
			status: "ready",
			source: "server",
			save: { state: { location: { checkpointId: "signal-core" } } },
		});
		expect(
			new LocalGameSaveRepository(storage, "player@example.com").load(),
		).toMatchObject({
			save: { state: { location: { checkpointId: "signal-core" } } },
		});
	});

	it("keeps offline progress and flushes it after connectivity returns", async () => {
		const storage = new MemoryStorage();
		const remote = new MemoryRemote();
		remote.available = false;
		const repository = new ServerGameSaveRepository(
			storage,
			"player@example.com",
			remote,
		);

		expect(await repository.save(stateAt("signal-core", 2))).toMatchObject({
			ok: false,
			synced: false,
			save: { state: { location: { checkpointId: "signal-core" } } },
		});
		expect(
			storage.getItem(pendingGameSaveStorageKey("player@example.com")),
		).not.toBeNull();

		remote.available = true;
		const result = await new ServerGameSaveRepository(
			storage,
			"player@example.com",
			remote,
		).load();
		expect(result).toMatchObject({
			status: "ready",
			source: "server",
			save: { state: { location: { checkpointId: "signal-core" } } },
		});
		expect(
			storage.getItem(pendingGameSaveStorageKey("player@example.com")),
		).toBeNull();
	});

	it("replays the same idempotency key when a save response is lost", async () => {
		const storage = new MemoryStorage();
		const remote = new MemoryRemote();
		remote.loseNextSaveResponse = true;
		const repository = new ServerGameSaveRepository(
			storage,
			"player@example.com",
			remote,
		);
		expect(await repository.save(stateAt("signal-core", 2))).toMatchObject({
			ok: false,
		});
		const firstKey = remote.requests[0].idempotencyKey;

		await new ServerGameSaveRepository(
			storage,
			"player@example.com",
			remote,
		).load();

		expect(remote.record?.revision).toBe(1);
		expect(remote.requests[1].idempotencyKey).toBe(firstKey);
	});

	it("rebases once when another browser advances the server revision", async () => {
		const storage = new MemoryStorage();
		const remote = new MemoryRemote();
		remote.record = record(createGameSave(stateAt("start", 1)), 1);
		const repository = new ServerGameSaveRepository(
			storage,
			"player@example.com",
			remote,
		);
		await repository.load();
		remote.record = record(createGameSave(stateAt("other-browser", 2)), 2);

		const result = await repository.save(stateAt("signal-core", 3));

		expect(result).toMatchObject({ ok: true, revision: 3 });
		expect(remote.requests).toHaveLength(2);
		expect(remote.requests.map((request) => request.expectedRevision)).toEqual([
			1, 2,
		]);
		expect(remote.record?.save.state.location.checkpointId).toBe("signal-core");
	});

	it("falls back safely for unavailable cloud and corrupt pending metadata", async () => {
		const storage = new MemoryStorage();
		storage.setItem(
			pendingGameSaveStorageKey("player@example.com"),
			"not-json",
		);
		const remote = new MemoryRemote();
		remote.available = false;

		expect(
			await new ServerGameSaveRepository(
				storage,
				"player@example.com",
				remote,
			).load(),
		).toEqual({
			status: "error",
			message:
				"Cloud saves are unavailable. Using the browser backup; sync will retry automatically.",
			source: "server",
		});
		expect(
			storage.getItem(pendingGameSaveStorageKey("player@example.com")),
		).toBeNull();
	});

	it("uses the owner-bound API client when no remote adapter is injected", async () => {
		const fetchMock = vi.fn(
			async (_input: RequestInfo | URL, init?: RequestInit) => {
				if ((init?.method ?? "GET") === "GET") {
					return Response.json({ save: null });
				}
				const request = JSON.parse(init?.body as string);
				return Response.json({
					save: {
						revision: 1,
						save: request.save,
						updatedAt: "2026-08-11T00:00:00.000Z",
					},
					idempotent: false,
				});
			},
		);
		vi.stubGlobal("fetch", fetchMock);
		const repository = new ServerGameSaveRepository(
			new MemoryStorage(),
			"owner@example.com",
		);

		expect(await repository.load()).toEqual({
			status: "empty",
			source: "server",
		});
		await expect(repository.save(stateAt("signal-core", 1))).resolves.toMatchObject(
			{ ok: true, revision: 1 },
		);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		for (const [, init] of fetchMock.mock.calls) {
			expect(new Headers(init?.headers).get("X-Game-Save-Owner")).toBe(
				"owner@example.com",
			);
		}
	});

	it.each([
		JSON.stringify({ version: 0, writes: [] }),
		JSON.stringify({ version: 1, writes: {} }),
		JSON.stringify({ version: 1, writes: [null] }),
		JSON.stringify({
			version: 1,
			writes: [{ idempotencyKey: 7, save: {} }],
		}),
		JSON.stringify({
			version: 1,
			writes: [
				{
					idempotencyKey: "a1a1a1a1-a1a1-41a1-a1a1-a1a1a1a1a1a1",
					expectedRevision: 0,
					save: {},
				},
			],
		}),
		JSON.stringify({
			version: 1,
			writes: [
				{
					idempotencyKey: "a1a1a1a1-a1a1-41a1-a1a1-a1a1a1a1a1a1",
					save: {},
				},
			],
		}),
	])("discards malformed pending operation metadata: %s", async (serialized) => {
		const storage = new MemoryStorage();
		storage.setItem(
			pendingGameSaveStorageKey("player@example.com"),
			serialized,
		);

		expect(
			await new ServerGameSaveRepository(
				storage,
				"player@example.com",
				new MemoryRemote(),
			).load(),
		).toEqual({ status: "empty", source: "server" });
		expect(
			storage.getItem(pendingGameSaveStorageKey("player@example.com")),
		).toBeNull();
	});

	it("bounds and flushes a long pending checkpoint queue", async () => {
		const storage = new MemoryStorage();
		const pendingSave = createGameSave(stateAt("signal-core", 1));
		storage.setItem(
			pendingGameSaveStorageKey("player@example.com"),
			JSON.stringify({
				version: 1,
				writes: Array.from({ length: 33 }, (_, index) => ({
					save: pendingSave,
					idempotencyKey: `a1a1a1a1-a1a1-41a1-a1a1-${index
						.toString(16)
						.padStart(12, "0")}`,
				})),
			}),
		);
		const remote = new MemoryRemote();

		await new ServerGameSaveRepository(
			storage,
			"player@example.com",
			remote,
		).load();

		expect(remote.requests).toHaveLength(32);
		expect(remote.record?.revision).toBe(32);
	});

	it("surfaces corrupt cloud data and honors load cancellation", async () => {
		const invalidRemote = new MemoryRemote();
		invalidRemote.record = {
			revision: 1,
			save: {} as GameSaveEnvelope,
			updatedAt: "2026-08-11T00:00:00.000Z",
		};
		await expect(
			new ServerGameSaveRepository(
				new MemoryStorage(),
				"player@example.com",
				invalidRemote,
			).load(),
		).resolves.toMatchObject({ status: "error", source: "server" });

		const controller = new AbortController();
		controller.abort();
		const cancellingRemote: GameSaveRemote = {
			load: async () => {
				throw new DOMException("aborted", "AbortError");
			},
			save: async () => {
				throw new DOMException("aborted", "AbortError");
			},
		};
		await expect(
			new ServerGameSaveRepository(
				new MemoryStorage(),
				"player@example.com",
				cancellingRemote,
			).load(controller.signal),
		).rejects.toThrow("aborted");
	});

	it("distinguishes a load conflict and keeps cloud saves working without storage", async () => {
		const storage = new MemoryStorage();
		new LocalGameSaveRepository(storage, "player@example.com").save(
			stateAt("signal-core", 1),
		);
		const conflictingRemote: GameSaveRemote = {
			load: async () => {
				throw new ApiRequestError(409, "conflict");
			},
			save: async () => {
				throw new ApiRequestError(409, "conflict");
			},
		};
		await expect(
			new ServerGameSaveRepository(
				storage,
				"player@example.com",
				conflictingRemote,
			).load(),
		).resolves.toMatchObject({
			status: "ready",
			source: "local",
			syncMessage: expect.stringContaining("another browser"),
		});

		const brokenStorage: GameSaveStorage = {
			getItem: () => null,
			setItem: () => {
				throw new Error("disabled");
			},
			removeItem: () => {
				throw new Error("disabled");
			},
		};
		await expect(
			new ServerGameSaveRepository(
				brokenStorage,
				"player@example.com",
				new MemoryRemote(),
			).save(stateAt("signal-core", 1)),
		).resolves.toMatchObject({ ok: true, revision: 1, synced: true });

		const offline = new MemoryRemote();
		offline.available = false;
		await expect(
			new ServerGameSaveRepository(
				brokenStorage,
				"player@example.com",
				offline,
			).save(stateAt("signal-core", 1)),
		).resolves.toEqual({
			ok: false,
			message: "Checkpoint could not be saved locally or to the cloud.",
			save: undefined,
			synced: false,
		});
	});
});
