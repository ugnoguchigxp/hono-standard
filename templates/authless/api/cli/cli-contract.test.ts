import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("CLI contract", () => {
	it("applies the pgvector document migration idempotently", () => {
		const result = spawnSync("bun", ["api/cli/migrate.ts"], {
			cwd: process.cwd(),
			encoding: "utf8",
			env: { ...process.env, DATABASE_URL: testDatabaseUrl },
		});
		expect(result.status, result.stderr).toBe(0);
		expect(
			JSON.parse(result.stdout.slice(result.stdout.lastIndexOf("{"))),
		).toMatchObject({
			ok: true,
			total: 1,
			applied: 1,
			skipped: 0,
		});
	});
});
