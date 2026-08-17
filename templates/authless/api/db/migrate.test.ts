import { describe, expect, it } from "vitest";
import type { AppEnv } from "../app/env";
import { runMigrations } from "./migrate";

describe("runMigrations", () => {
	it("handles the empty authless migration set idempotently", async () => {
		const env = { databaseUrl: ":memory:" } as AppEnv;

		await expect(runMigrations(env)).resolves.toEqual({
			ok: true,
			total: 0,
			applied: 0,
			skipped: 0,
		});
		await expect(runMigrations(env)).resolves.toEqual({
			ok: true,
			total: 0,
			applied: 0,
			skipped: 0,
		});
	});

});
