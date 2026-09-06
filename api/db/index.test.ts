import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app/env";

const { connect, end, query, release, Pool, Client } = vi.hoisted(() => {
	const connect = vi.fn();
	const end = vi.fn();
	const query = vi.fn();
	const release = vi.fn();
	class Pool {
		connect = connect;
		end = end;
		query = query;
		constructor(_options?: unknown) {}
	}
	class Client {
		connect = connect;
		query = query;
	}
	return { connect, end, query, release, Pool, Client };
});

vi.mock("pg", () => ({ Pool, Client }));
vi.mock("drizzle-orm/node-postgres", () => ({
	drizzle: (client: unknown) => ({ client }),
}));

describe("PostgreSQL database runtime", () => {
	beforeEach(() => {
		connect.mockReset();
		end.mockReset();
		query.mockReset();
		release.mockReset();
	});

	it("creates an owned pool runtime and closes it", async () => {
		const { createDbRuntime, schema } = await import("./index");
		const runtime = createDbRuntime({
			databaseUrl: "postgres://localhost/hono_standard",
		} as AppEnv);

		expect(runtime.connection.ownsConnection).toBe(true);
		expect(runtime.client.read).toBe(runtime.db);
		expect(schema.users).toBeDefined();
		await runtime.close();
		expect(end).toHaveBeenCalledOnce();
	});

	it("wraps external clients and handles pool and client connectivity", async () => {
		const { connectDb, wrapExternalClient } = await import("./index");
		const pool = new Pool();
		connect.mockResolvedValueOnce({ release });
		await connectDb(pool as never);
		expect(release).toHaveBeenCalledOnce();

		const client = new Client();
		connect.mockResolvedValueOnce(undefined);
		await connectDb(client as never);
		expect(wrapExternalClient(client as never).ownsConnection).toBe(false);
	});

	it("ignores an already connected client but preserves other errors", async () => {
		const { connectDb } = await import("./index");
		const client = new Client();
		connect.mockRejectedValueOnce(
			new Error("Client has already been connected"),
		);
		await expect(connectDb(client as never)).resolves.toBeUndefined();
		connect.mockRejectedValueOnce(new Error("network unavailable"));
		await expect(connectDb(client as never)).rejects.toThrow(
			"network unavailable",
		);
	});

	it("checks write access, schema, and migration state without persisting data", async () => {
		const { createDbRuntime } = await import("./index");
		query
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] })
			.mockResolvedValueOnce({
				rows: [
					{
						users: "users",
						refresh_tokens: "refresh_tokens",
						documents: "documents",
						vector_extension: true,
					},
				],
			})
			.mockResolvedValueOnce({
				rows: [
					{ filename: "0001_auth.sql" },
					{ filename: "0002_documents.sql" },
					{ filename: "0003_refresh_token_reuse_detection.sql" },
				],
			})
			.mockResolvedValueOnce({ rows: [] });
		connect.mockResolvedValueOnce({ query, release });
		const runtime = createDbRuntime({
			databaseUrl: "postgres://localhost/hono_standard",
		} as AppEnv);

		await runtime.checkReady();
		expect(query.mock.calls.map(([sql]) => sql)).toEqual([
			"BEGIN READ WRITE",
			"SELECT 1",
			expect.stringContaining("to_regclass"),
			expect.stringContaining("hono_standard_schema_migrations"),
			"ROLLBACK",
		]);
		expect(release).toHaveBeenCalledOnce();
		await runtime.close();
		await runtime.close();
		await expect(runtime.checkReady()).rejects.toThrow("closed");
	});

	it("rejects readiness when migrations are pending and rolls back", async () => {
		const { createDbRuntime } = await import("./index");
		query
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: [
					{
						users: "users",
						refresh_tokens: "refresh_tokens",
						documents: "documents",
						vector_extension: true,
					},
				],
			})
			.mockResolvedValueOnce({ rows: [{ filename: "0001_auth.sql" }] })
			.mockResolvedValueOnce({ rows: [] });
		connect.mockResolvedValueOnce({ query, release });
		const runtime = createDbRuntime({
			databaseUrl: "postgres://localhost/hono_standard",
		} as AppEnv);

		await expect(runtime.checkReady()).rejects.toThrow("pending");
		expect(query).toHaveBeenLastCalledWith("ROLLBACK");
		await runtime.close();
	});

	it("rejects readiness when required tables are missing", async () => {
		const { createDbRuntime } = await import("./index");
		query
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: [
					{
						users: "users",
						refresh_tokens: "refresh_tokens",
						documents: null,
						vector_extension: true,
					},
				],
			})
			.mockResolvedValueOnce({ rows: [] });
		connect.mockResolvedValueOnce({ query, release });
		const runtime = createDbRuntime({
			databaseUrl: "postgres://localhost/hono_standard",
		} as AppEnv);

		await expect(runtime.checkReady()).rejects.toThrow("tables are missing");
		expect(query).toHaveBeenLastCalledWith("ROLLBACK");
		await runtime.close();
	});
});
