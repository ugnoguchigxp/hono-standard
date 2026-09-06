import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

it("detects an unmigrated database and schema loss, and rejects a closed database", () => {
	const directory = mkdtempSync(path.join(tmpdir(), "hono-ready-"));
	try {
		const result = spawnSync(
			"bun",
			[
				"-e",
				`
import assert from "node:assert/strict";
import { Database } from "bun:sqlite";
import { createSqliteDbRuntime } from "./api/db/sqlite.ts";
import { runSqliteMigrations } from "./api/db/migrate-sqlite.ts";
const env = { databaseUrl: process.env.READY_TEST_DB };
const empty = createSqliteDbRuntime(env);
await assert.rejects(empty.checkReady());
await empty.close();
await runSqliteMigrations(env);
const runtime = createSqliteDbRuntime(env);
await runtime.checkReady();
const writer = new Database(env.databaseUrl);
writer.run("BEGIN IMMEDIATE");
const start = performance.now();
await assert.rejects(runtime.checkReady());
assert.ok(performance.now() - start < 1000, "readiness blocked on an external writer");
writer.run("ROLLBACK");
await runtime.checkReady();
writer.run("ALTER TABLE hono_standard_schema_migrations RENAME TO missing_history");
await assert.rejects(runtime.checkReady());
writer.run("ALTER TABLE missing_history RENAME TO hono_standard_schema_migrations");
await runtime.checkReady();
const userTable = writer.query("SELECT name FROM sqlite_schema WHERE name='users'").get();
if (userTable) {
 writer.run("ALTER TABLE users RENAME COLUMN email TO missing_email");
 await assert.rejects(runtime.checkReady());
 writer.run("ALTER TABLE users RENAME COLUMN missing_email TO email");
 await runtime.checkReady();
}
writer.close();
await runtime.close();
await assert.rejects(runtime.checkReady());
`,
			],
			{
				encoding: "utf8",
				env: {
					...process.env,
					READY_TEST_DB: path.join(directory, "app.sqlite"),
				},
				timeout: 10_000,
			},
		);
		expect(result.status, result.stderr).toBe(0);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
