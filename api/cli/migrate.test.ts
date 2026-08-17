import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app/env";

const readAppEnv = vi.fn();
const runMigrations = vi.fn();

vi.mock("../app/env", () => ({
	readAppEnv,
}));

vi.mock("../db/migrate", () => ({
	runMigrations,
}));

describe("migrate CLI", () => {
	beforeEach(() => {
		readAppEnv.mockReset();
		runMigrations.mockReset();
	});

	it("prints the migration result as JSON", async () => {
		const env = { databaseUrl: ":memory:" } as AppEnv;
		const result = { ok: true as const, total: 2, applied: 1, skipped: 1 };
		readAppEnv.mockReturnValue(env);
		runMigrations.mockResolvedValue(result);
		const write = vi.fn();
		const { runMigrateCli } = await import("./migrate");

		await expect(runMigrateCli({ write })).resolves.toEqual(result);
		expect(runMigrations).toHaveBeenCalledWith(env);
		expect(write).toHaveBeenCalledWith(JSON.stringify(result, null, 2));
	});

	it("uses console.log when a writer is not supplied", async () => {
		const env = { databaseUrl: ":memory:" } as AppEnv;
		const result = { ok: true as const, total: 0, applied: 0, skipped: 0 };
		readAppEnv.mockReturnValue(env);
		runMigrations.mockResolvedValue(result);
		const write = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			const { runMigrateCli } = await import("./migrate");
			await expect(runMigrateCli()).resolves.toEqual(result);
			expect(write).toHaveBeenCalledWith(JSON.stringify(result, null, 2));
		} finally {
			write.mockRestore();
		}
	});
});
