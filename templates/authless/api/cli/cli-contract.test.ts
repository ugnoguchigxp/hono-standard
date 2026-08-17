import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempRoots: string[] = [];

afterEach(() => {
	for (const tempRoot of tempRoots.splice(0)) {
		fs.rmSync(tempRoot, { recursive: true, force: true });
	}
});

describe("CLI contract", () => {
	it("runs an empty initial migration set idempotently", () => {
		const tempRoot = fs.mkdtempSync(
			path.join(os.tmpdir(), "hono-authless-cli-"),
		);
		tempRoots.push(tempRoot);
		const databaseUrl = `file:${path.join(tempRoot, "data", "sqlite.db")}`;
		const result = spawnSync("bun", ["api/cli/migrate.ts"], {
			cwd: process.cwd(),
			encoding: "utf8",
			env: { ...process.env, DATABASE_URL: databaseUrl },
		});
		expect(result.status, result.stderr).toBe(0);
		expect(
			JSON.parse(result.stdout.slice(result.stdout.lastIndexOf("{"))),
		).toMatchObject({
			ok: true,
			total: 0,
			applied: 0,
			skipped: 0,
		});
	});
});
