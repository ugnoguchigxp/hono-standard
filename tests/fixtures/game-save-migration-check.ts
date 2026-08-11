import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import path from "node:path";
import { readAppEnv } from "../../api/app/env";
import { runSqliteMigrations } from "../../api/db/migrate-sqlite";
import { validateGameContentDirectory } from "../../scripts/validate-game-content";
import { createGameSave, createInitialGameState } from "../../shared/game";
import { GAME_IDS } from "../../shared/game-platform";

const databaseUrl = process.env.GAME_SAVE_MIGRATION_TEST_DATABASE;
if (!databaseUrl) {
	throw new Error("GAME_SAVE_MIGRATION_TEST_DATABASE is required.");
}

const client = new Database(databaseUrl, { create: true });
const migrationNames = ["0001_auth.sql", "0002_game_saves.sql"] as const;
client.run(`
	CREATE TABLE hono_standard_schema_migrations (
		filename text PRIMARY KEY,
		applied_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
	)
`);
for (const migration of migrationNames) {
	client.run(
		readFileSync(path.join(process.cwd(), "drizzle", migration), "utf8"),
	);
	client
		.query("INSERT INTO hono_standard_schema_migrations (filename) VALUES (?)")
		.run(migration);
}

const userId = "d7d7d7d7-d7d7-47d7-a7d7-d7d7d7d7d7d7";
const saveId = "legacy-autosave";
const registry = validateGameContentDirectory();
const save = createGameSave(createInitialGameState({ registry, rngSeed: 23 }));
const timestamp = Math.floor(Date.now() / 1_000);
client
	.query(
		"INSERT INTO users (id, email, password_hash, display_name, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
	)
	.run(
		userId,
		"migration@example.com",
		"unused",
		"Migration",
		"member",
		1,
		timestamp,
		timestamp,
	);
client
	.query(
		"INSERT INTO game_saves (id, user_id, game_id, slot_id, revision, content_version, state_revision, saved_at, save_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
	)
	.run(
		saveId,
		userId,
		GAME_IDS.rpg2d,
		"autosave",
		7,
		save.state.contentVersion,
		save.state.revision,
		save.savedAt,
		JSON.stringify(save),
		timestamp,
		timestamp,
	);
client.close();

const env = readAppEnv({
	NODE_ENV: "test",
	DATABASE_URL: databaseUrl,
	JWT_SECRET: "test-secret-that-is-at-least-32-characters",
});
const migration = await runSqliteMigrations(env);
const migrated = new Database(databaseUrl, { readonly: true });
try {
	const backfill = migrated
		.query(
			"SELECT revision, save_json, checksum FROM game_save_versions WHERE user_id = ? AND game_id = ? AND slot_id = ?",
		)
		.get(userId, GAME_IDS.rpg2d, "autosave") as {
		revision: number;
		save_json: string;
		checksum: string;
	} | null;
	const integrity = migrated.query("PRAGMA integrity_check").get() as Record<
		string,
		string
	>;
	const foreignKeys = migrated.query("PRAGMA foreign_key_check").all();
	if (
		migration.applied !== 1 ||
		migration.skipped !== 2 ||
		backfill?.revision !== 7 ||
		backfill.save_json !== JSON.stringify(save) ||
		backfill.checksum !== `legacy:${saveId}` ||
		Object.values(integrity)[0] !== "ok" ||
		foreignKeys.length !== 0
	) {
		throw new Error("The production-like save migration rehearsal failed.");
	}
	console.log(
		JSON.stringify({
			ok: true,
			applied: migration.applied,
			backfilledRevision: backfill.revision,
			integrity: "ok",
		}),
	);
} finally {
	migrated.close();
}
