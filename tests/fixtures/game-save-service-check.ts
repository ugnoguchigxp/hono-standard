import { readAppEnv } from "../../api/app/env";
import { runSqliteMigrations } from "../../api/db/migrate-sqlite";
import { users } from "../../api/db/schema";
import { createSqliteDbRuntime } from "../../api/db/sqlite";
import { HttpError } from "../../api/modules/auth/errors";
import { GameSaveService } from "../../api/modules/game-save/game-save.service";
import { validateGameContentDirectory } from "../../scripts/validate-game-content";
import { createGameSave, createInitialGameState } from "../../shared/game";
import { GAME_IDS } from "../../shared/game-platform";

const databaseUrl = process.env.GAME_SAVE_TEST_DATABASE;
if (!databaseUrl) throw new Error("GAME_SAVE_TEST_DATABASE is required.");

const env = readAppEnv({
	NODE_ENV: "test",
	DATABASE_URL: databaseUrl,
	JWT_SECRET: "test-secret-that-is-at-least-32-characters",
});
await runSqliteMigrations(env);
const runtime = createSqliteDbRuntime(env);

try {
	const userA = "a1a1a1a1-a1a1-41a1-a1a1-a1a1a1a1a1a1";
	const userB = "b2b2b2b2-b2b2-42b2-b2b2-b2b2b2b2b2b2";
	await runtime.client.write.execute((db) =>
		db
			.insert(users)
			.values([
				{
					id: userA,
					email: "a@example.com",
					passwordHash: "unused",
					displayName: "A",
				},
				{
					id: userB,
					email: "b@example.com",
					passwordHash: "unused",
					displayName: "B",
				},
			])
			.run(),
	);

	const registry = validateGameContentDirectory();
	const service = new GameSaveService(runtime.client, registry);
	const state = createInitialGameState({ registry, rngSeed: 7 });
	const firstSave = createGameSave(state, "2026-08-11T00:00:00.000Z");
	const base = {
		userId: userA,
		gameId: GAME_IDS.rpg2d,
		slotId: "autosave",
	};

	if ((await service.load(userA, GAME_IDS.rpg2d, "autosave")) !== null) {
		throw new Error("Expected an initially empty save slot.");
	}
	const created = await service.save({
		...base,
		save: firstSave,
		intent: "advance",
		baseRevision: null,
		expectedRevision: null,
		idempotencyKey: "c3c3c3c3-c3c3-43c3-c3c3-c3c3c3c3c3c3",
	});
	if (created.record.revision !== 1 || created.idempotent) {
		throw new Error("Initial save did not create revision 1.");
	}

	const replayed = await service.save({
		...base,
		save: firstSave,
		intent: "advance",
		baseRevision: null,
		expectedRevision: null,
		idempotencyKey: "c3c3c3c3-c3c3-43c3-c3c3-c3c3c3c3c3c3",
	});
	if (replayed.record.revision !== 1 || !replayed.idempotent) {
		throw new Error("Idempotent replay changed the save revision.");
	}

	let conflict: unknown;
	try {
		await service.save({
			...base,
			save: firstSave,
			intent: "advance",
			baseRevision: null,
			expectedRevision: null,
			idempotencyKey: "d4d4d4d4-d4d4-44d4-d4d4-d4d4d4d4d4d4",
		});
	} catch (error) {
		conflict = error;
	}
	if (!(conflict instanceof HttpError) || conflict.status !== 409) {
		throw new Error("A stale revision was not rejected.");
	}

	state.story.flags["integration-updated"] = true;
	state.revision += 1;
	const secondSave = createGameSave(state, "2026-08-11T00:01:00.000Z");
	const updated = await service.save({
		...base,
		save: secondSave,
		intent: "advance",
		baseRevision: 1,
		expectedRevision: 1,
		idempotencyKey: "e5e5e5e5-e5e5-45e5-e5e5-e5e5e5e5e5e5",
	});
	if (updated.record.revision !== 2) {
		throw new Error("Expected revision 2 after an update.");
	}
	if ((await service.load(userB, GAME_IDS.rpg2d, "autosave")) !== null) {
		throw new Error("One user could read another user's save.");
	}
	if (!(await service.delete(userA, GAME_IDS.rpg2d, "autosave"))) {
		throw new Error("Expected the save to be deleted.");
	}
	if ((await service.load(userA, GAME_IDS.rpg2d, "autosave")) !== null) {
		throw new Error("Deleted save was still readable.");
	}

	console.log(JSON.stringify({ ok: true, finalRevision: 2 }));
} finally {
	await runtime.close();
}
