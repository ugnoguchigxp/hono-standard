import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("GameSaveService SQLite integration", () => {
	it("migrates, isolates users, enforces revisions, and replays idempotently", () => {
		const directory = mkdtempSync(path.join(tmpdir(), "hono-game-save-"));
		try {
			const result = spawnSync(
				"bun",
				["tests/fixtures/game-save-service-check.ts"],
				{
					cwd: process.cwd(),
					encoding: "utf8",
					env: {
						...process.env,
						GAME_SAVE_TEST_DATABASE: path.join(directory, "game.db"),
					},
				},
			);
			expect(result.status, result.stderr || result.stdout).toBe(0);
			expect(result.stdout).toContain('"ok":true');
			expect(result.stdout).toContain('"finalRevision":2');
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
});
