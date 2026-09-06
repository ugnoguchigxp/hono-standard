import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

it("backs up committed WAL data, verifies corruption, and restores to a new database without overwriting files", () => {
	const directory = mkdtempSync(path.join(tmpdir(), "hono-restore-test-"));
	try {
		const script = `
import assert from "node:assert/strict";
import { Database } from "bun:sqlite";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { backupDatabase, restoreDatabase, verifySnapshot } from "./scripts/db-snapshot.ts";
const root = process.env.SNAPSHOT_TEST_DIR;
const source = root + "/source.sqlite";
const snapshot = root + "/backups/backup.sqlite";
const restored = root + "/restored.sqlite";
const writer = new Database(source, { create: true });
try {
 writer.run("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE parent(id INTEGER PRIMARY KEY, value TEXT); CREATE TABLE child(id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id)); INSERT INTO parent VALUES(1, 'committed'); INSERT INTO child VALUES(1, 1)");
 assert.ok(statSync(source + "-wal").size > 0);
 writer.run("BEGIN IMMEDIATE; INSERT INTO parent VALUES(2, 'uncommitted')");
 const saved = await backupDatabase(source, snapshot);
 writer.run("ROLLBACK; INSERT INTO parent VALUES(3, 'after snapshot')");
 await assert.rejects(backupDatabase(source, snapshot));
 await assert.rejects(restoreDatabase(snapshot, snapshot));
 assert.equal((await verifySnapshot(snapshot)).sha256, saved.sha256);
 const result = await restoreDatabase(snapshot, restored);
 assert.equal(result.sha256, saved.sha256);
 assert.equal(statSync(snapshot).mode & 0o777, 0o600);
 assert.equal(statSync(restored).mode & 0o777, 0o600);
 const db = new Database(restored);
 assert.deepEqual(db.query("SELECT * FROM parent").all(), [{id:1, value:"committed"}]);
 assert.equal(db.query("SELECT COUNT(*) AS count FROM child").get().count, 1);
 db.run("PRAGMA foreign_keys=ON");
 assert.throws(() => db.run("INSERT INTO child VALUES(2, 999)"));
 db.run("INSERT INTO parent VALUES(4, 'restored writable')");
 db.close();
 const original = readFileSync(source);
 await assert.rejects(backupDatabase(source, source));
 await assert.rejects(restoreDatabase(snapshot, source));
 assert.deepEqual(readFileSync(source), original);
 assert.equal(writer.query("SELECT COUNT(*) AS count FROM parent").get().count, 2);
 const broken = root + "/broken.sqlite";
 writeFileSync(broken, "not a database");
 await assert.rejects(verifySnapshot(broken));
 await assert.rejects(restoreDatabase(broken, root + "/never.sqlite"));
 assert.equal(existsSync(root + "/never.sqlite"), false);
 writeFileSync(root + "/stale.sqlite-wal", "stale");
 await assert.rejects(backupDatabase(source, root + "/stale.sqlite"));
 await assert.rejects(verifySnapshot(source));
 const bad = new Database(root + "/orphan.sqlite", { create: true });
 bad.run("CREATE TABLE p(id INTEGER PRIMARY KEY); CREATE TABLE c(id INTEGER REFERENCES p(id)); INSERT INTO c VALUES(99)"); bad.close();
 await assert.rejects(verifySnapshot(root + "/orphan.sqlite"), /foreign key/);
 await assert.rejects(backupDatabase(root + "/orphan.sqlite", root + "/invalid-backup.sqlite"));
 assert.equal(existsSync(root + "/invalid-backup.sqlite"), false);
 await assert.rejects(backupDatabase(":memory:", root + "/memory.sqlite"));
} finally { writer.close(); }
`;
		const result = spawnSync("bun", ["-e", script], {
			encoding: "utf8",
			env: { ...process.env, SNAPSHOT_TEST_DIR: directory },
			timeout: 15_000,
		});
		expect(result.status, result.stderr).toBe(0);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
