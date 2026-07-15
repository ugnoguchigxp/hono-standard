import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

describe("createDbRuntime", () => {
	const temporaryDirectories: string[] = [];

	afterEach(() => {
		for (const directory of temporaryDirectories.splice(0)) {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("uses WAL and a query-only reader for local file databases", () => {
		const directory = mkdtempSync(path.join(tmpdir(), "hono-standard-turso-"));
		temporaryDirectories.push(directory);
		const databaseUrl = `file:${path.join(directory, "app.sqlite")}`;
		const script = `
			import { sql } from "drizzle-orm";
			import { createDbRuntime } from "./api/db/index.ts";
			const runtime = await createDbRuntime({ databaseUrl: process.env.TEST_DATABASE_URL });
			try {
				const mode = await runtime.client.write.execute((db) => db.get(sql\`PRAGMA journal_mode\`));
				if (!JSON.stringify(mode).toLowerCase().includes("wal")) throw new Error("WAL was not enabled");
				await runtime.client.write.execute((db) => db.run(sql\`CREATE TABLE messages (id INTEGER PRIMARY KEY, body TEXT)\`));
				await runtime.client.write.execute((db) => db.run(sql\`INSERT INTO messages (body) VALUES ('hello')\`));
				const row = await runtime.client.read.get(sql\`SELECT body FROM messages LIMIT 1\`);
				if (!JSON.stringify(row).includes("hello")) throw new Error("reader did not observe committed write");
				let queryOnlyError = false;
				try {
					await runtime.client.read.run(sql\`INSERT INTO messages (body) VALUES ('not allowed')\`);
				} catch {
					queryOnlyError = true;
				}
				if (!queryOnlyError) throw new Error("reader accepted a write");
			} finally {
				await runtime.close();
			}
		`;
		const result = spawnSync("bun", ["-e", script], {
			cwd: process.cwd(),
			encoding: "utf8",
			env: {
				...process.env,
				TEST_DATABASE_URL: databaseUrl,
			},
		});

		expect(result.status, result.stderr).toBe(0);
	});
});
