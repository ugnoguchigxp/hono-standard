import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app/env";

const { appliedByFile, databases, FakeDatabase, readdir, readFile } =
	vi.hoisted(() => {
		const appliedByFile = new Map<string, Set<string>>();
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

			get applied() {
				const existing = appliedByFile.get(this.filename);
				if (existing) return existing;
				const created = new Set<string>();
				appliedByFile.set(this.filename, created);
				return created;
			}

			run(sql: string) {
				this.runs.push(sql);
				if (sql.includes("THROW_MIGRATION")) {
					throw new Error("migration sql failed");
				}
			}

			query(sql: string) {
				return {
					all: () =>
						sql === "PRAGMA foreign_key_check"
							? []
							: [...this.applied].map((filename) => ({
									filename,
									applied_at: "now",
								})),
					run: (filename: string) => {
						this.applied.add(filename);
					},
					get: () => 1,
				};
			}

			close() {
				this.closed = true;
			}
		}

		return {
			appliedByFile,
			databases,
			FakeDatabase: FakeSqlite,
			readdir: vi.fn(),
			readFile: vi.fn(),
		};
	});

vi.mock("bun:sqlite", () => ({
	Database: FakeDatabase,
}));

vi.mock("node:fs/promises", () => ({
	readdir,
	readFile,
}));

describe("runSqliteMigrations", () => {
	const temporaryDirectories: string[] = [];

	afterEach(() => {
		databases.length = 0;
		appliedByFile.clear();
		readdir.mockReset();
		readFile.mockReset();
		for (const directory of temporaryDirectories.splice(0)) {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("applies pending SQL files and skips already applied migrations", async () => {
		const directory = mkdtempSync(path.join(tmpdir(), "hono-migrate-"));
		temporaryDirectories.push(directory);
		const { runSqliteMigrations } = await import("./migrate-sqlite");
		readdir.mockResolvedValue([
			{ name: "0001_init.sql", isFile: () => true },
			{ name: "readme.md", isFile: () => true },
			{ name: "nested", isFile: () => false },
			{ name: "0002_auth.sql", isFile: () => true },
		]);
		readFile.mockResolvedValue("SELECT 1;");

		const env = {
			databaseUrl: path.join(directory, "data", "app.sqlite"),
		} as AppEnv;
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		await expect(runSqliteMigrations(env)).resolves.toEqual({
			ok: true,
			total: 2,
			applied: 2,
			skipped: 0,
		});
		expect(log).toHaveBeenCalledWith("applied: 0001_init.sql");
		expect(databases[0]?.closed).toBe(true);

		await expect(runSqliteMigrations(env)).resolves.toEqual({
			ok: true,
			total: 2,
			applied: 0,
			skipped: 2,
		});
		log.mockRestore();
	});

	it("rolls back a failed migration file", async () => {
		const directory = mkdtempSync(path.join(tmpdir(), "hono-migrate-fail-"));
		temporaryDirectories.push(directory);
		const { runSqliteMigrations } = await import("./migrate-sqlite");
		readdir.mockResolvedValue([{ name: "0001_bad.sql", isFile: () => true }]);
		readFile.mockResolvedValue("THROW_MIGRATION");

		await expect(
			runSqliteMigrations({
				databaseUrl: path.join(directory, "app.sqlite"),
			} as AppEnv),
		).rejects.toThrow("migration sql failed");

		expect(databases[0]?.runs).toContain("BEGIN IMMEDIATE");
		expect(databases[0]?.runs).toContain("ROLLBACK");
		expect(databases[0]?.closed).toBe(true);
	});
});
