import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGameSave, createInitialGameState } from "../../../shared/game";
import { GAME_IDS } from "../../../shared/game-platform";
import { validateGameContentDirectory } from "../../../scripts/validate-game-content";
import type { AppDatabaseClient } from "../../db";
import { gameSaveOperations, gameSaves } from "../../db/schema";
import { HttpError } from "../auth/errors";
import { GameSaveService } from "./game-save.service";

const registry = validateGameContentDirectory();
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
	expectedRevision: null,
	idempotencyKey: "b2b2b2b2-b2b2-42b2-b2b2-b2b2b2b2b2b2",
};

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

const createHarness = () => {
	const state: {
		saveRow: SaveRow | null;
		operationRow: OperationRow | null;
		updatedValues: Record<string, unknown> | null;
		deletedOperations: boolean;
	} = {
		saveRow: null,
		operationRow: null,
		updatedValues: null,
		deletedOperations: false,
	};

	const select = () => ({
		from: (table: unknown) => ({
			where: () => ({
				get: () =>
					table === gameSaves ? state.saveRow : state.operationRow,
			}),
		}),
	});
	const insert = (table: unknown) => ({
			values: (values: Record<string, unknown>) => ({
				run: () => {
					if (table === gameSaves) {
						state.saveRow = {
							...(values as Omit<SaveRow, "id">),
							id: "save-id",
						};
					} else {
						state.operationRow = {
							...(values as Omit<OperationRow, "id">),
							id: "operation-id",
						};
					}
				},
			}),
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
	return { state, service: new GameSaveService(client) };
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

	it("deletes the save and operation history and reports an empty delete", async () => {
		const harness = createHarness();
		await harness.service.save(input);
		await expect(
			harness.service.delete(userId, GAME_IDS.rpg2d, "autosave"),
		).resolves.toBe(true);
		expect(harness.state.deletedOperations).toBe(true);

		await expect(
			harness.service.delete(userId, GAME_IDS.rpg2d, "autosave"),
		).resolves.toBe(false);
	});
});
