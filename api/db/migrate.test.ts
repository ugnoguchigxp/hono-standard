import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app/env";

const runSqliteMigrations = vi.fn();

vi.mock("./migrate-sqlite", () => ({
	runSqliteMigrations,
}));

describe("runMigrations", () => {
	beforeEach(() => {
		runSqliteMigrations.mockReset();
	});

	it("delegates to the SQLite migration runner", async () => {
		const result = { ok: true as const, total: 2, applied: 2, skipped: 0 };
		runSqliteMigrations.mockResolvedValue(result);
		const { runMigrations } = await import("./migrate");
		const env = { databaseUrl: ":memory:" } as AppEnv;

		await expect(runMigrations(env)).resolves.toEqual(result);
		expect(runSqliteMigrations).toHaveBeenCalledWith(env);
	});
});
