import { mkdtempSync, rmSync } from "node:fs";
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

	it("applies libSQL migrations once and records subsequent runs", async () => {
		const directory = mkdtempSync(
			path.join(tmpdir(), "hono-libsql-migrations-"),
		);
		temporaryDirectories.push(directory);
		const env = {
			databaseUrl: `file:${path.join(directory, "app.sqlite")}`,
		} as AppEnv;

		await expect(runMigrations(env)).resolves.toMatchObject({
			ok: true,
			applied: 2,
			skipped: 0,
		});
		await expect(runMigrations(env)).resolves.toMatchObject({
			ok: true,
			applied: 0,
			skipped: 2,
		});
	});

	it("supports in-memory databases without a local path", async () => {
		await expect(
			runMigrations({ databaseUrl: ":memory:" } as AppEnv),
		).resolves.toMatchObject({
			ok: true,
			applied: 2,
			skipped: 0,
		});
	});
});
