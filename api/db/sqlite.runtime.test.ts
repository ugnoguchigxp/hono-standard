import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app/env";

const { databases, FakeDatabase } = vi.hoisted(() => {
	const databases: FakeSqlite[] = [];

	class FakeSqlite {
		closed = false;
		runs: string[] = [];

		constructor(
			readonly filename: string,
			readonly options?: { create?: boolean; readonly?: boolean },
		) {
			databases.push(this);
		}

		run(sql: string) {
			this.runs.push(sql);
		}

		query(sql: string) {
			this.runs.push(sql);
			return {
				get: () => 1,
				all: () => [],
				run: () => undefined,
			};
		}

		close() {
			this.closed = true;
		}
	}

	return { databases, FakeDatabase: FakeSqlite };
});

vi.mock("bun:sqlite", () => ({
	Database: FakeDatabase,
}));

vi.mock("drizzle-orm/bun-sqlite", () => ({
	drizzle: (client: InstanceType<typeof FakeDatabase>) => ({ client }),
}));

describe("createSqliteDbRuntime wiring", () => {
	const temporaryDirectories: string[] = [];

	afterEach(() => {
		databases.length = 0;
		for (const directory of temporaryDirectories.splice(0)) {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("shares the writer connection for in-memory databases", async () => {
		const { createSqliteDbRuntime, connectDb } = await import("./sqlite");
		const runtime = createSqliteDbRuntime({
			databaseUrl: ":memory:",
		} as AppEnv);

		expect(databases).toHaveLength(1);
		expect(databases[0]?.runs).toEqual(
			expect.arrayContaining([
				"PRAGMA journal_mode = WAL;",
				"PRAGMA busy_timeout = 5000;",
				"PRAGMA foreign_keys = ON;",
			]),
		);

		const writer = databases[0];
		expect(writer).toBeDefined();
		if (!writer) throw new Error("expected writer database");
		await connectDb(writer as unknown as import("bun:sqlite").Database);
		await runtime.close();
		await runtime.close();
		expect(writer.closed).toBe(true);
	});

	it("opens a dedicated readonly reader for file databases", async () => {
		const directory = mkdtempSync(path.join(tmpdir(), "hono-sqlite-runtime-"));
		temporaryDirectories.push(directory);
		const { createSqliteDbRuntime } = await import("./sqlite");
		const runtime = createSqliteDbRuntime({
			databaseUrl: path.join(directory, "app.sqlite"),
		} as AppEnv);

		expect(databases).toHaveLength(2);
		expect(databases[0]?.options).toEqual({ create: true });
		expect(databases[1]?.options).toEqual({ readonly: true });
		expect(databases[1]?.runs).toEqual(
			expect.arrayContaining([
				"PRAGMA busy_timeout = 5000;",
				"PRAGMA foreign_keys = ON;",
			]),
		);

		await runtime.close();
		expect(databases[0]?.closed).toBe(true);
		expect(databases[1]?.closed).toBe(true);
	});

	it("treats file::memory: URLs as in-memory databases", async () => {
		const { createSqliteDbRuntime } = await import("./sqlite");
		const runtime = createSqliteDbRuntime({
			databaseUrl: "file::memory:?cache=shared",
		} as AppEnv);

		expect(databases).toHaveLength(1);
		await runtime.close();
	});
});
