import {
	createAction3dSave,
	createInitialAction3dState,
} from "@shared/action3d";
import { describe, expect, it, vi } from "vitest";
import { validateAction3dContentDirectory } from "../../../../scripts/validate-action3d-content";
import { ApiRequestError } from "../../api";
import type { Action3dSaveRemote } from "./ServerAction3dSaveRepository";
import { ServerAction3dSaveRepository } from "./ServerAction3dSaveRepository";

const memoryStorage = () => {
	const values = new Map<string, string>();
	return {
		values,
		storage: {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
			removeItem: (key: string) => values.delete(key),
		},
	};
};

describe("ServerAction3dSaveRepository", () => {
	it("uses the server as authority and keeps a browser backup", async () => {
		let record: Awaited<ReturnType<Action3dSaveRemote["load"]>>["save"] = null;
		const remote: Action3dSaveRemote = {
			load: vi.fn(async () => ({ save: record })),
			save: vi.fn(async (request) => {
				record = {
					revision: (record?.revision ?? 0) + 1,
					save: request.save,
					updatedAt: request.save.savedAt,
				};
				return { save: record, idempotent: false };
			}),
		};
		const { storage, values } = memoryStorage();
		const repository = new ServerAction3dSaveRepository(
			storage,
			"player@example.com",
			remote,
		);
		expect(await repository.load()).toEqual({ status: "empty", source: "server" });
		const result = await repository.save(
			createInitialAction3dState(validateAction3dContentDirectory()),
			"2026-08-11T00:00:00.000Z",
		);
		expect(result).toMatchObject({ ok: true, revision: 1, synced: true });
		expect([...values.keys()]).toContain(
			"action-3d:checkpoint:player%40example.com",
		);
		expect(await repository.load()).toMatchObject({
			status: "ready",
			source: "server",
		});
	});

	it("queues offline writes and surfaces revision conflicts", async () => {
		const state = createInitialAction3dState(validateAction3dContentDirectory());
		const offlineStorage = memoryStorage().storage;
		const offline = new ServerAction3dSaveRepository(
			offlineStorage,
			"offline@example.com",
			{
				load: async () => ({ save: null }),
				save: async () => { throw new Error("offline"); },
			},
		);
		await offline.load();
		expect(await offline.save(state)).toMatchObject({
			ok: false,
			status: "queued-offline",
			synced: false,
		});
		const conflict = new ServerAction3dSaveRepository(
			memoryStorage().storage,
			"conflict@example.com",
			{
				load: async () => ({ save: null }),
				save: async () => { throw new ApiRequestError(409, "conflict"); },
			},
		);
		await conflict.load();
		expect(await conflict.save(state)).toMatchObject({
			ok: false,
			status: "conflict",
		});
	});

	it("resolves a divergent checkpoint by an explicit cloud or browser choice", async () => {
		const registry = validateAction3dContentDirectory();
		const cloudState = createInitialAction3dState(registry);
		const browserState = createInitialAction3dState(registry);
		browserState.revision = 4;
		let record = {
			revision: 1,
			save: createAction3dSave(cloudState, "2026-08-11T00:00:00.000Z"),
			updatedAt: "2026-08-11T00:00:00.000Z",
		};
		const requests: Array<{ intent?: string; baseRevision?: number | null }> = [];
		const remote: Action3dSaveRemote = {
			load: async () => ({ save: record }),
			save: async (request) => {
				requests.push(request);
				if (request.expectedRevision !== record.revision)
					throw new ApiRequestError(409, "conflict");
				record = {
					revision: record.revision + 1,
					save: request.save,
					updatedAt: request.save.savedAt,
				};
				return { save: record, idempotent: false };
			},
		};
		const repository = new ServerAction3dSaveRepository(
			memoryStorage().storage,
			"resolve@example.com",
			remote,
		);
		await repository.load();
		record = { ...record, revision: 2 };
		const write = await repository.save(browserState);
		expect(write).toMatchObject({
			ok: false,
			status: "conflict",
			conflict: { baseRevision: 1, cloudSave: { revision: 2 } },
		});
		if (write.ok || !write.conflict) throw new Error("Expected a conflict.");

		await expect(
			repository.resolveConflict(write.conflict, "browser"),
		).resolves.toMatchObject({
			status: "ready",
			source: "server",
			save: { state: { revision: 4 } },
		});
		expect(requests.at(-1)).toMatchObject({
			intent: "resolve-browser",
			baseRevision: 1,
		});

		const cloudRepository = new ServerAction3dSaveRepository(
			memoryStorage().storage,
			"cloud@example.com",
			remote,
		);
		await expect(
			cloudRepository.resolveConflict(
				{
					browserSave: createAction3dSave(browserState),
					cloudSave: record,
					baseRevision: 1,
				},
				"cloud",
			),
		).resolves.toMatchObject({
			status: "ready",
			syncMessage: "Cloud checkpoint kept.",
		});
	});
});
