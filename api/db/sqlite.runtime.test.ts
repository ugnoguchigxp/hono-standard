import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app/env";

const { databases, FakeDatabase } = vi.hoisted(() => {
	const databases: FakeSqlite[] = [];
	class FakeSqlite {
		closed = false;
		queries: string[] = [];

		constructor(readonly filename: string) {
			databases.push(this);
		}

		close() {
			this.closed = true;
		}

		query(sql: string) {
			this.queries.push(sql);
			return { get: () => 1 };
		}
	}
	return { databases, FakeDatabase: FakeSqlite };
});

vi.mock("bun:sqlite", () => ({ Database: FakeDatabase }));
vi.mock("drizzle-orm/bun-sqlite", () => ({
	drizzle: (client: InstanceType<typeof FakeDatabase>) => ({ client }),
}));

describe("SQLite compatibility runtime", () => {
	it("owns created connections and leaves wrapped external connections open", async () => {
		const { connectDb, createSqliteDbRuntime, wrapExternalClient } =
			await import("./sqlite");
		const runtime = createSqliteDbRuntime({
			databaseUrl: ":memory:",
		} as AppEnv);
		const owned = databases[0];
		expect(owned).toBeDefined();
		if (!owned) throw new Error("expected an owned SQLite connection");

		await connectDb(owned as unknown as import("bun:sqlite").Database);
		expect(owned.queries).toContain("SELECT 1");
		runtime.close();
		expect(owned.closed).toBe(true);

		const unownedRuntime = createSqliteDbRuntime({
			databaseUrl: ":memory:",
		} as AppEnv);
		unownedRuntime.connection.ownsConnection = false;
		unownedRuntime.close();
		expect(databases[1]?.closed).toBe(false);

		const external = new FakeDatabase(":memory:");
		const wrapped = wrapExternalClient(
			external as unknown as import("bun:sqlite").Database,
		);
		expect(wrapped.ownsConnection).toBe(false);
	});
});
