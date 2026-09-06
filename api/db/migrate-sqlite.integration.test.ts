import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

it("rejects orphaned data atomically and preserves children during parent-table rebuilds", () => {
	const root = mkdtempSync(path.join(tmpdir(), "hono-migration-integrity-"));
	try {
		const result = spawnSync(
			"bun",
			[
				"-e",
				`
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { Database } from "bun:sqlite";
import { runSqliteMigrations } from ${JSON.stringify(path.resolve("api/db/migrate-sqlite.ts"))};
const env = { databaseUrl: process.cwd() + "/integrity.sqlite" };
mkdirSync("drizzle");
writeFileSync("drizzle/0001_init.sql", \`
CREATE TABLE parent (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id) ON DELETE CASCADE);
INSERT INTO parent VALUES (1, 'preserved');
INSERT INTO child VALUES (1, 1);
\`);
await runSqliteMigrations(env);
const db = new Database(env.databaseUrl);
writeFileSync("drizzle/0002_change.sql", "INSERT INTO child VALUES (2, 999);");
await assert.rejects(runSqliteMigrations(env), /Foreign key violations/);
assert.equal(db.query("SELECT COUNT(*) AS n FROM child").get().n, 1);
assert.equal(db.query("SELECT COUNT(*) AS n FROM hono_standard_schema_migrations").get().n, 1);
// This is the table-rebuild sequence emitted by Drizzle for SQLite.
writeFileSync("drizzle/0002_change.sql", \`
PRAGMA foreign_keys=OFF;
CREATE TABLE __new_parent (id INTEGER PRIMARY KEY, value TEXT NOT NULL, note TEXT);
INSERT INTO __new_parent (id, value) SELECT id, value FROM parent;
DROP TABLE parent;
ALTER TABLE __new_parent RENAME TO parent;
PRAGMA foreign_keys=ON;
\`);
await runSqliteMigrations(env);
assert.deepEqual(db.query("SELECT * FROM parent").all(), [{id: 1, value: 'preserved', note: null}]);
assert.deepEqual(db.query("SELECT * FROM child").all(), [{id: 1, parent_id: 1}]);
assert.deepEqual(db.query("PRAGMA foreign_key_check").all(), []);
assert.equal((await runSqliteMigrations(env)).skipped, 2);
db.run("PRAGMA foreign_keys=OFF");
db.run("INSERT INTO child VALUES (3, 999)");
await assert.rejects(runSqliteMigrations(env), /existing database/);
db.close();
`,
			],
			{ cwd: root, encoding: "utf8", env: process.env },
		);
		expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}, 15_000);
