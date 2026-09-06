import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AppEnv } from "../app/env";
import { runMigrations } from "./migrate";

describe("runMigrations", () => {
	const temporaryDirectories: string[] = [];

	afterEach(() => {
		for (const directory of temporaryDirectories.splice(0)) {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("applies an added migration once and records subsequent runs", async () => {
		const directory = mkdtempSync(
			path.join(tmpdir(), "hono-authless-migrations-"),
		);
		temporaryDirectories.push(directory);
		const migrationsDir = path.join(directory, "drizzle");
		mkdirSync(migrationsDir);
		writeFileSync(
			path.join(migrationsDir, "0001_sample.sql"),
			"CREATE TABLE sample (id text PRIMARY KEY);",
		);
		writeFileSync(
			path.join(migrationsDir, "0002_sample_detail.sql"),
			"CREATE TABLE sample_detail (id text PRIMARY KEY);",
		);
		writeFileSync(path.join(migrationsDir, "README.md"), "ignored");
		const env = {
			databaseUrl: `file:${path.join(directory, "data", "app.sqlite")}`,
		} as AppEnv;

		await expect(runMigrations(env, migrationsDir)).resolves.toEqual({
			ok: true,
			total: 2,
			applied: 2,
			skipped: 0,
		});
		await expect(runMigrations(env, migrationsDir)).resolves.toEqual({
			ok: true,
			total: 2,
			applied: 0,
			skipped: 2,
		});
	});

	it("supports an empty in-memory migration set", async () => {
		const directory = mkdtempSync(
			path.join(tmpdir(), "hono-authless-empty-migrations-"),
		);
		temporaryDirectories.push(directory);
		await expect(
			runMigrations({ databaseUrl: ":memory:" } as AppEnv, directory),
		).resolves.toEqual({
			ok: true,
			total: 0,
			applied: 0,
			skipped: 0,
		});
	});
});
