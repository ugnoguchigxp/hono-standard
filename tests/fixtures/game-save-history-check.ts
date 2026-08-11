import { and, eq, sql } from "drizzle-orm";
import { readAppEnv } from "../../api/app/env";
import { runSqliteMigrations } from "../../api/db/migrate-sqlite";
import {
	gameSaveOperations,
	gameSaves,
	gameSaveVersions,
	users,
} from "../../api/db/schema";
import { createSqliteDbRuntime } from "../../api/db/sqlite";
import { GameSaveService } from "../../api/modules/game-save/game-save.service";
import { validateGameContentDirectory } from "../../scripts/validate-game-content";
import {
	createGameSave,
	createInitialGameState,
	MANUAL_SAVE_SLOT_IDS,
} from "../../shared/game";
import { GAME_IDS } from "../../shared/game-platform";

const databaseUrl = process.env.GAME_SAVE_HISTORY_TEST_DATABASE;
if (!databaseUrl)
	throw new Error("GAME_SAVE_HISTORY_TEST_DATABASE is required.");

const env = readAppEnv({
	NODE_ENV: "test",
	DATABASE_URL: databaseUrl,
	JWT_SECRET: "test-secret-that-is-at-least-32-characters",
});
await runSqliteMigrations(env);
const runtime = createSqliteDbRuntime(env);

try {
	const userId = "f6f6f6f6-f6f6-46f6-b6f6-f6f6f6f6f6f6";
	await runtime.client.write.execute((db) =>
		db
			.insert(users)
			.values({
				id: userId,
				email: "history@example.com",
				passwordHash: "unused",
				displayName: "History",
			})
			.run(),
	);
	const registry = validateGameContentDirectory();
	const service = new GameSaveService(runtime.client, registry);
	const state = createInitialGameState({ registry, rngSeed: 17 });
	let expectedRevision: number | null = null;
	for (let index = 0; index < 135; index += 1) {
		state.revision = index;
		const save = createGameSave(
			state,
			new Date(Date.UTC(2026, 7, 11, 0, index)).toISOString(),
		);
		const result = await service.save({
			userId,
			gameId: GAME_IDS.rpg2d,
			slotId: "autosave",
			save,
			intent: "advance",
			baseRevision: expectedRevision,
			expectedRevision,
			idempotencyKey: crypto.randomUUID(),
		});
		expectedRevision = result.record.revision;
	}

	for (const slotId of MANUAL_SAVE_SLOT_IDS) {
		const save = createGameSave(state, new Date().toISOString(), slotId);
		await service.save({
			userId,
			gameId: GAME_IDS.rpg2d,
			slotId,
			save,
			intent: "reset",
			baseRevision: null,
			expectedRevision: null,
			idempotencyKey: crypto.randomUUID(),
		});
	}
	for (let revision = 1; revision <= 4; revision += 1) {
		state.revision += 1;
		const manualSave = createGameSave(
			state,
			new Date(Date.UTC(2026, 7, 12, 0, revision)).toISOString(),
			"manual-1",
		);
		await service.save({
			userId,
			gameId: GAME_IDS.rpg2d,
			slotId: "manual-1",
			save: manualSave,
			intent: "advance",
			baseRevision: revision,
			expectedRevision: revision,
			idempotencyKey: crypto.randomUUID(),
		});
	}

	const historyCount = await runtime.client.read
		.select({ count: sql<number>`count(*)` })
		.from(gameSaveVersions)
		.where(
			and(
				eq(gameSaveVersions.userId, userId),
				eq(gameSaveVersions.gameId, GAME_IDS.rpg2d),
				eq(gameSaveVersions.slotId, "autosave"),
			),
		)
		.get();
	const operationCount = await runtime.client.read
		.select({ count: sql<number>`count(*)` })
		.from(gameSaveOperations)
		.where(
			and(
				eq(gameSaveOperations.userId, userId),
				eq(gameSaveOperations.gameId, GAME_IDS.rpg2d),
				eq(gameSaveOperations.slotId, "autosave"),
			),
		)
		.get();
	const manualHistoryCount = await runtime.client.read
		.select({ count: sql<number>`count(*)` })
		.from(gameSaveVersions)
		.where(
			and(
				eq(gameSaveVersions.userId, userId),
				eq(gameSaveVersions.gameId, GAME_IDS.rpg2d),
				eq(gameSaveVersions.slotId, "manual-1"),
			),
		)
		.get();
	if (historyCount?.count !== 10)
		throw new Error("Autosave history was not bounded to 10.");
	if (manualHistoryCount?.count !== 3)
		throw new Error("Manual history was not bounded to 3.");
	if (operationCount?.count !== 128)
		throw new Error("Operation history was not bounded to 128.");
	if ((await service.listSlots(userId, GAME_IDS.rpg2d)).length !== 4) {
		throw new Error("Autosave and three manual slots were not isolated.");
	}

	const history = await service.listHistory(userId, GAME_IDS.rpg2d, "autosave");
	const source = history[0];
	if (!source || expectedRevision === null)
		throw new Error("Expected restore history.");
	const restored = await service.restore(
		userId,
		GAME_IDS.rpg2d,
		"autosave",
		source.revision,
		expectedRevision,
		crypto.randomUUID(),
	);
	await runtime.client.write.execute((db) =>
		db
			.update(gameSaves)
			.set({ saveJson: "not-json" })
			.where(
				and(
					eq(gameSaves.userId, userId),
					eq(gameSaves.gameId, GAME_IDS.rpg2d),
					eq(gameSaves.slotId, "autosave"),
				),
			)
			.run(),
	);
	const recovery = await service.load(userId, GAME_IDS.rpg2d, "autosave");
	if (
		!recovery?.recovery ||
		recovery.recovery.currentRevision !== restored.record.revision
	) {
		throw new Error("A verified recovery candidate was not returned.");
	}

	console.log(
		JSON.stringify({
			ok: true,
			historyCount: historyCount.count,
			manualHistoryCount: manualHistoryCount.count,
			operationCount: operationCount.count,
			slotCount: 4,
			recovery: true,
		}),
	);
} finally {
	await runtime.close();
}
