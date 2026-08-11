import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateAction3dContentDirectory } from "../../../scripts/validate-action3d-content";
import { validateGameContentDirectory } from "../../../scripts/validate-game-content";
import {
	createAction3dSave,
	createInitialAction3dState,
} from "../../../shared/action3d";
import { createGameSave, createInitialGameState } from "../../../shared/game";
import { GAME_IDS } from "../../../shared/game-platform";
import type { AppDatabaseClient } from "../../db";
import {
	gameSaveOperations,
	gameSaves,
	gameSaveVersions,
} from "../../db/schema";
import { HttpError } from "../auth/errors";
import { GameSaveService } from "./game-save.service";

const registry = validateGameContentDirectory();
const action3dRegistry = validateAction3dContentDirectory();
const userId = "a1a1a1a1-a1a1-41a1-a1a1-a1a1a1a1a1a1";
const fixedDate = new Date("2026-08-11T00:00:00.000Z");
const save = createGameSave(
	createInitialGameState({ registry, rngSeed: 99 }),
	fixedDate.toISOString(),
);
const input = {
	userId,
	gameId: GAME_IDS.rpg2d,
	slotId: "autosave",
	save,
	intent: "advance" as const,
	baseRevision: null,
	expectedRevision: null,
	idempotencyKey: "b2b2b2b2-b2b2-42b2-b2b2-b2b2b2b2b2b2",
};
const action3dSave = createAction3dSave(
	createInitialAction3dState(action3dRegistry),
	fixedDate.toISOString(),
);

type SaveRow = {
	id: string;
	userId: string;
	gameId: string;
	slotId: string;
	revision: number;
	contentVersion: string;
	stateRevision: number;
	savedAt: string;
	saveJson: string;
	createdAt: Date;
	updatedAt: Date;
};

type OperationRow = {
	id: string;
	userId: string;
	gameId: string;
	slotId: string;
	idempotencyKey: string;
	requestHash: string;
	resultRevision: number;
	resultSaveJson: string;
	resultUpdatedAt: string;
	createdAt: Date;
};

type HistoryRow = {
	id: string;
	userId: string;
	gameId: string;
	slotId: string;
	revision: number;
	contentVersion: string;
	stateRevision: number;
	savedAt: string;
	saveJson: string;
	checksum: string;
	createdAt: Date;
};

const checksum = (serialized: string): string =>
	createHash("sha256").update(serialized).digest("hex");

const saveRow = (
	envelope: typeof save | typeof action3dSave,
	revision = 1,
): SaveRow => ({
	id: "save-id",
	userId,
	gameId: "gameId" in envelope ? envelope.gameId : GAME_IDS.rpg2d,
	slotId: envelope.slotId,
	revision,
	contentVersion: envelope.state.contentVersion,
	stateRevision: envelope.state.revision,
	savedAt: envelope.savedAt,
	saveJson: JSON.stringify(envelope),
	createdAt: fixedDate,
	updatedAt: fixedDate,
});

const historyRow = (
	envelope: typeof save | typeof action3dSave,
	revision = 1,
): HistoryRow => {
	const saveJson = JSON.stringify(envelope);
	return {
		id: `history-${revision}`,
		userId,
		gameId: "gameId" in envelope ? envelope.gameId : GAME_IDS.rpg2d,
		slotId: envelope.slotId,
		revision,
		contentVersion: envelope.state.contentVersion,
		stateRevision: envelope.state.revision,
		savedAt: envelope.savedAt,
		saveJson,
		checksum: checksum(saveJson),
		createdAt: fixedDate,
	};
};

const createHarness = () => {
	const state: {
		saveRow: SaveRow | null;
		operationRow: OperationRow | null;
		historyRows: HistoryRow[];
		updatedValues: Record<string, unknown> | null;
		deletedOperations: boolean;
		deletedHistory: boolean;
	} = {
		saveRow: null,
		operationRow: null,
		historyRows: [],
		updatedValues: null,
		deletedOperations: false,
		deletedHistory: false,
	};

	const select = () => ({
		from: (table: unknown) => ({
			where: () => {
				const rows =
					table === gameSaves
						? state.saveRow
							? [state.saveRow]
							: []
						: table === gameSaveOperations
							? state.operationRow
								? [state.operationRow]
								: []
							: state.historyRows;
				return {
					get: () => rows[0] ?? null,
					orderBy: () => ({ all: () => rows }),
				};
			},
		}),
	});
	const insert = (table: unknown) => ({
		values: (values: Record<string, unknown>) => {
			const run = () => {
				if (table === gameSaves) {
					state.saveRow = {
						...(values as Omit<SaveRow, "id">),
						id: "save-id",
					};
				} else if (table === gameSaveOperations) {
					state.operationRow = {
						...(values as Omit<OperationRow, "id">),
						id: "operation-id",
					};
				} else {
					state.historyRows.unshift({
						...(values as Omit<HistoryRow, "id">),
						id: `history-${state.historyRows.length + 1}`,
					});
				}
			};
			return {
				run,
				onConflictDoNothing: () => ({ run }),
			};
		},
	});
	const update = () => ({
			set: (values: Record<string, unknown>) => ({
				where: () => ({
					run: () => {
						state.updatedValues = values;
						if (state.saveRow) Object.assign(state.saveRow, values);
					},
				}),
			}),
		});
	const remove = (table: unknown) => ({
			where: () => ({
				returning: () => ({
					all: () => {
						const deleted = state.saveRow ? [{ id: state.saveRow.id }] : [];
						state.saveRow = null;
						return deleted;
					},
				}),
				run: () => {
					if (table === gameSaveOperations) {
						state.operationRow = null;
						state.deletedOperations = true;
					} else if (table === gameSaveVersions) {
						state.historyRows = [];
						state.deletedHistory = true;
					}
				},
			}),
		});
	type FakeTransaction = {
		select: typeof select;
		transaction: <TResult>(
			operation: (database: FakeTransaction) => TResult,
		) => TResult;
		insert: typeof insert;
		update: typeof update;
		delete: typeof remove;
	};
	const tx: FakeTransaction = {
		select,
		transaction: (operation) => operation(tx),
		insert,
		update,
		delete: remove,
	};
	const client = {
		read: { select },
		write: {
			execute: async <TResult>(
				operation: (database: typeof tx) => TResult | Promise<TResult>,
			) => operation(tx),
			close: async () => undefined,
		},
	} as unknown as AppDatabaseClient;
	return {
		client,
		state,
		service: new GameSaveService(client, registry, action3dRegistry),
	};
};

describe("GameSaveService", () => {
	beforeEach(() => vi.useRealTimers());

	it("loads an isolated current save or an empty slot", async () => {
		const harness = createHarness();
		expect(
			await harness.service.load(userId, GAME_IDS.rpg2d, "autosave"),
		).toBeNull();
		harness.state.saveRow = {
			id: "save-id",
			userId,
			gameId: GAME_IDS.rpg2d,
			slotId: "autosave",
			revision: 3,
			contentVersion: save.state.contentVersion,
			stateRevision: save.state.revision,
			savedAt: save.savedAt,
			saveJson: JSON.stringify(save),
			createdAt: fixedDate,
			updatedAt: fixedDate,
		};
		expect(
			await harness.service.load(userId, GAME_IDS.rpg2d, "autosave"),
		).toEqual({
			revision: 3,
			save,
			updatedAt: fixedDate.toISOString(),
		});
	});

	it("rejects invalid persisted JSON instead of serving corrupt progress", async () => {
		const harness = createHarness();
		harness.state.saveRow = {
			id: "save-id",
			userId,
			gameId: GAME_IDS.rpg2d,
			slotId: "autosave",
			revision: 1,
			contentVersion: save.state.contentVersion,
			stateRevision: save.state.revision,
			savedAt: save.savedAt,
			saveJson: "not-json",
			createdAt: fixedDate,
			updatedAt: fixedDate,
		};
		await expect(
			harness.service.load(userId, GAME_IDS.rpg2d, "autosave"),
		).rejects.toEqual(expect.objectContaining({ status: 500 }));
	});

	it("recovers a corrupt current save from the newest verified history", async () => {
		const harness = createHarness();
		harness.state.saveRow = {
			...saveRow(save, 3),
			saveJson: "not-json",
		};
		const invalidChecksum = historyRow(save, 2);
		invalidChecksum.checksum = "0".repeat(64);
		harness.state.historyRows = [invalidChecksum, historyRow(save, 1)];

		await expect(
			harness.service.load(userId, GAME_IDS.rpg2d, "autosave"),
		).resolves.toMatchObject({
			revision: 1,
			recovery: { currentRevision: 3, sourceRevision: 1 },
		});
	});

	it("classifies slot and history metadata without serving invalid payloads", async () => {
		const harness = createHarness();
		harness.state.saveRow = saveRow(save);
		await expect(
			harness.service.listSlots(userId, GAME_IDS.rpg2d),
		).resolves.toMatchObject([
			{
				status: "ready",
				mapId: save.state.location.mapId,
				checkpointId: save.state.location.checkpointId,
			},
		]);

		harness.state.saveRow.saveJson = "not-json";
		await expect(
			harness.service.listSlots(userId, GAME_IDS.rpg2d),
		).resolves.toMatchObject([{ status: "corrupt", mapId: null }]);

		const incompatible = structuredClone(save);
		incompatible.state.location.mapId = "missing-map";
		harness.state.saveRow = saveRow(incompatible);
		await expect(
			harness.service.listSlots(userId, GAME_IDS.rpg2d),
		).resolves.toMatchObject([{ status: "incompatible" }]);

		const corruptHistory = historyRow(save, 2);
		corruptHistory.saveJson = "not-json";
		harness.state.historyRows = [
			historyRow(save, 3),
			corruptHistory,
			historyRow(incompatible, 1),
		];
		await expect(
			harness.service.listHistory(userId, GAME_IDS.rpg2d, "autosave"),
		).resolves.toMatchObject([
			{ revision: 3, status: "ready", mapId: save.state.location.mapId },
			{ revision: 2, status: "corrupt", mapId: null },
			{ revision: 1, status: "incompatible", mapId: null },
		]);
	});

	it("validates and loads Action3D checkpoints against their content registry", async () => {
		const harness = createHarness();
		harness.state.saveRow = saveRow(action3dSave, 4);
		await expect(
			harness.service.load(userId, GAME_IDS.action3d, "checkpoint"),
		).resolves.toMatchObject({ revision: 4, save: { gameId: GAME_IDS.action3d } });

		const incompatible = structuredClone(action3dSave);
		incompatible.state.location.worldId = "missing-world";
		harness.state.saveRow = saveRow(incompatible, 5);
		await expect(
			harness.service.load(userId, GAME_IDS.action3d, "checkpoint"),
		).rejects.toEqual(expect.objectContaining({ status: 500 }));

		const withoutRegistries = new GameSaveService(harness.client);
		await expect(
			withoutRegistries.load(userId, GAME_IDS.action3d, "checkpoint"),
		).resolves.toMatchObject({ revision: 5 });
	});

	it("creates revision one and records the idempotent result", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(fixedDate);
		const harness = createHarness();

		await expect(harness.service.save(input)).resolves.toEqual({
			record: { revision: 1, save, updatedAt: fixedDate.toISOString() },
			idempotent: false,
		});
		expect(harness.state.saveRow).toMatchObject({
			revision: 1,
			contentVersion: save.state.contentVersion,
			stateRevision: save.state.revision,
		});
		expect(harness.state.operationRow).toMatchObject({
			idempotencyKey: input.idempotencyKey,
			resultRevision: 1,
		});
	});

	it("keeps compatibility defaults isolated from registry-backed validation", async () => {
		const loaded = createHarness();
		loaded.state.saveRow = saveRow(save);
		await expect(
			new GameSaveService(loaded.client).load(
				userId,
				GAME_IDS.rpg2d,
				"autosave",
			),
		).resolves.toMatchObject({ revision: 1 });

		const written = createHarness();
		await expect(
			written.service.save({
				...input,
				intent: undefined,
				baseRevision: undefined,
			}),
		).resolves.toMatchObject({ record: { revision: 1 } });
	});

	it("returns the original result for a replay and rejects key reuse", async () => {
		const first = createHarness();
		await first.service.save(input);
		const operation = first.state.operationRow;
		if (!operation) throw new Error("Expected an operation row.");

		const replay = createHarness();
		replay.state.operationRow = operation;
		await expect(replay.service.save(input)).resolves.toMatchObject({
			record: { revision: 1, save },
			idempotent: true,
		});

		const reused = createHarness();
		reused.state.operationRow = operation;
		await expect(
			reused.service.save({
				...input,
				expectedRevision: 1,
			}),
		).rejects.toEqual(expect.objectContaining({ status: 409 }));
	});

	it("rejects a stale revision and updates a matching existing save", async () => {
		const stale = createHarness();
		stale.state.saveRow = {
			id: "save-id",
			userId,
			gameId: GAME_IDS.rpg2d,
			slotId: "autosave",
			revision: 2,
			contentVersion: save.state.contentVersion,
			stateRevision: save.state.revision,
			savedAt: save.savedAt,
			saveJson: JSON.stringify(save),
			createdAt: fixedDate,
			updatedAt: fixedDate,
		};
		await expect(stale.service.save(input)).rejects.toEqual(
			expect.objectContaining({
				status: 409,
				message: expect.stringContaining("expected null, current 2"),
			}),
		);

		const nextSave = structuredClone(save);
		nextSave.state.revision += 1;
		nextSave.savedAt = "2026-08-11T00:01:00.000Z";
		await expect(
			stale.service.save({
				...input,
				save: nextSave,
				baseRevision: 2,
				expectedRevision: 2,
				idempotencyKey: "c3c3c3c3-c3c3-43c3-c3c3-c3c3c3c3c3c3",
			}),
		).resolves.toMatchObject({ record: { revision: 3 }, idempotent: false });
		expect(stale.state.updatedValues).toMatchObject({
			revision: 3,
			stateRevision: nextSave.state.revision,
			savedAt: nextSave.savedAt,
		});
	});

	it("rejects semantically incompatible content before changing the slot", async () => {
		const harness = createHarness();
		const incompatible = structuredClone(save);
		incompatible.state.location.mapId = "missing-map";

		await expect(
			harness.service.save({ ...input, save: incompatible }),
		).rejects.toEqual(
			expect.objectContaining({
				status: 400,
				message: expect.stringContaining("incompatible"),
			}),
		);
		expect(harness.state.saveRow).toBeNull();
		expect(harness.state.operationRow).toBeNull();
	});

	it("allows stale replacement only through an explicit divergent intent", async () => {
		const harness = createHarness();
		await harness.service.save(input);
		harness.state.operationRow = null;
		const replacement = structuredClone(save);
		replacement.state.revision += 1;

		await expect(
			harness.service.save({
				...input,
				save: replacement,
				baseRevision: null,
				expectedRevision: 1,
				idempotencyKey: "d4d4d4d4-d4d4-44d4-d4d4-d4d4d4d4d4d4",
			}),
		).rejects.toEqual(expect.objectContaining({ status: 409 }));
		harness.state.operationRow = null;

		await expect(
			harness.service.save({
				...input,
				intent: "resolve-browser",
				save: replacement,
				baseRevision: null,
				expectedRevision: 1,
				idempotencyKey: "e5e5e5e5-e5e5-45e5-e5e5-e5e5e5e5e5e5",
			}),
		).resolves.toMatchObject({ record: { revision: 2 } });
	});

	it("restores a verified historical revision and rejects missing or damaged history", async () => {
		const missing = createHarness();
		await expect(
			missing.service.restore(
				userId,
				GAME_IDS.rpg2d,
				"autosave",
				1,
				2,
				crypto.randomUUID(),
			),
		).rejects.toEqual(expect.objectContaining({ status: 404 }));

		const damaged = createHarness();
		const badHistory = historyRow(save);
		badHistory.checksum = "0".repeat(64);
		damaged.state.historyRows = [badHistory];
		await expect(
			damaged.service.restore(
				userId,
				GAME_IDS.rpg2d,
				"autosave",
				1,
				2,
				crypto.randomUUID(),
			),
		).rejects.toEqual(expect.objectContaining({ status: 400 }));

		const restored = createHarness();
		restored.state.saveRow = saveRow(save, 2);
		restored.state.historyRows = [historyRow(save, 1)];
		await expect(
			restored.service.restore(
				userId,
				GAME_IDS.rpg2d,
				"autosave",
				1,
				2,
				crypto.randomUUID(),
			),
		).resolves.toMatchObject({ record: { revision: 3 }, idempotent: false });
	});

	it("deletes the save and operation history and reports an empty delete", async () => {
		const harness = createHarness();
		await harness.service.save(input);
		await expect(
			harness.service.delete(userId, GAME_IDS.rpg2d, "autosave"),
		).resolves.toBe(true);
		expect(harness.state.deletedOperations).toBe(true);
		expect(harness.state.deletedHistory).toBe(true);

		await expect(
			harness.service.delete(userId, GAME_IDS.rpg2d, "autosave"),
		).resolves.toBe(false);
	});
});
