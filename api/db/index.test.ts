import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app/env";

const { connect, end, release, Pool, Client } = vi.hoisted(() => {
	const connect = vi.fn();
	const end = vi.fn();
	const release = vi.fn();
	class Pool {
		connect = connect;
		end = end;
		constructor(_options?: unknown) {}
	}
	class Client {
		connect = connect;
	}
	return { connect, end, release, Pool, Client };
});

vi.mock("pg", () => ({ Pool, Client }));
vi.mock("drizzle-orm/node-postgres", () => ({
	drizzle: (client: unknown) => ({ client }),
}));

describe("PostgreSQL database runtime", () => {
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
});
