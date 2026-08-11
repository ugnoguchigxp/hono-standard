import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("GameSaveService history integration", () => {
	it("rehearses migration and backfill on a production-like SQLite copy", () => {
		const directory = mkdtempSync(path.join(tmpdir(), "hono-game-migration-"));
		try {
			const result = spawnSync(
				"bun",
				["tests/fixtures/game-save-migration-check.ts"],
				{
					cwd: process.cwd(),
					encoding: "utf8",
					env: {
						...process.env,
						GAME_SAVE_MIGRATION_TEST_DATABASE: path.join(
							directory,
							"game.db",
						),
					},
				},
			);
			expect(result.status, result.stderr || result.stdout).toBe(0);
			expect(result.stdout).toContain('"backfilledRevision":7');
			expect(result.stdout).toContain('"integrity":"ok"');
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("bounds history and operations, isolates slots, restores, and recovers", () => {
		const directory = mkdtempSync(path.join(tmpdir(), "hono-game-history-"));
		try {
			const result = spawnSync(
				"bun",
				["tests/fixtures/game-save-history-check.ts"],
				{
					cwd: process.cwd(),
					encoding: "utf8",
					env: {
						...process.env,
						GAME_SAVE_HISTORY_TEST_DATABASE: path.join(directory, "game.db"),
					},
				},
			);
			expect(result.status, result.stderr || result.stdout).toBe(0);
			expect(result.stdout).toContain('"historyCount":10');
			expect(result.stdout).toContain('"manualHistoryCount":3');
			expect(result.stdout).toContain('"operationCount":128');
			expect(result.stdout).toContain('"recovery":true');
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
});
