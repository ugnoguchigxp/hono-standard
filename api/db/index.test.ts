import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app/env";

const createSqliteDbRuntime = vi.fn();

vi.mock("./sqlite", () => ({
	createSqliteDbRuntime,
	connectDb: vi.fn(),
}));

describe("createDbRuntime", () => {
	beforeEach(() => {
		createSqliteDbRuntime.mockReset();
	});

	it("delegates to the SQLite runtime factory", async () => {
		const runtime = { close: vi.fn() };
		createSqliteDbRuntime.mockReturnValue(runtime);
		const { createDbRuntime, schema } = await import("./index");
		const env = { databaseUrl: ":memory:" } as AppEnv;

		expect(createDbRuntime(env)).toBe(runtime);
		expect(createSqliteDbRuntime).toHaveBeenCalledWith(env);
		expect(schema.users).toBeDefined();
		expect(schema.refreshTokens).toBeDefined();
	});
});
