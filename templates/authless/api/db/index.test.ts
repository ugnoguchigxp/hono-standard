import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app/env";

const { connect, end, query, release, Pool, Client, writer } = vi.hoisted(
	() => {
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
		return {
			connect,
			end,
			query,
			release,
			Pool,
			Client,
			writer: { close: vi.fn().mockResolvedValue(undefined) },
		};
	},
);

vi.mock("pg", () => ({ Pool, Client }));
vi.mock("drizzle-orm/node-postgres", () => ({
	drizzle: (client: unknown) => ({ client }),
}));
vi.mock("./client", () => ({
	createSingleWriterClient: vi.fn(() => writer),
}));

describe("authless PostgreSQL database runtime", () => {
	const temporaryDirectories: string[] = [];

	beforeEach(() => {
		connect.mockReset();
		end.mockReset();
		query.mockReset();
		release.mockReset();
		writer.close.mockClear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		for (const directory of temporaryDirectories.splice(0)) {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});

	it("creates an owned pool runtime and closes it", async () => {
		const { createDbRuntime, schema } = await import("./index");
		const runtime = createDbRuntime({
			databaseUrl: "postgres://localhost/hono_standard",
		} as AppEnv);

		expect(runtime.connection.ownsConnection).toBe(true);
		expect(runtime.client.read).toBe(runtime.db);
		expect(schema.documents).toBeDefined();
		await runtime.close();
		await runtime.close();
		expect(writer.close).toHaveBeenCalledOnce();
		expect(end).toHaveBeenCalledOnce();
		await expect(runtime.checkReady()).rejects.toThrow("closed");
	});

	it("checks write access, pgvector schema, and the migration ledger", async () => {
		query
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [{ value: 1 }] })
			.mockResolvedValueOnce({
				rows: [{ documents: "documents", vector_extension: true }],
			})
			.mockResolvedValueOnce({ rows: [{ filename: "0002_documents.sql" }] })
			.mockResolvedValueOnce({ rows: [] });
		connect.mockResolvedValueOnce({ query, release });
		const { createDbRuntime } = await import("./index");
		const runtime = createDbRuntime({
			databaseUrl: "postgres://localhost/hono_standard",
		} as AppEnv);

		await runtime.checkReady();
		expect(query.mock.calls.map(([sql]) => sql)).toEqual([
			"BEGIN READ WRITE",
			"SELECT 1",
			expect.stringContaining("pg_extension"),
			expect.stringContaining("hono_standard_schema_migrations"),
			"ROLLBACK",
		]);
		expect(release).toHaveBeenCalledOnce();
		await runtime.close();
	});

	it("rejects a pending migration and rolls back", async () => {
		const directory = fs.mkdtempSync(
			path.join(os.tmpdir(), "hono-authless-pg-readiness-"),
		);
		temporaryDirectories.push(directory);
		const migrationsDirectory = path.join(directory, "drizzle");
		fs.mkdirSync(migrationsDirectory);
		fs.writeFileSync(
			path.join(migrationsDirectory, "0001_sample.sql"),
			"SELECT 1;",
		);
		fs.writeFileSync(
			path.join(migrationsDirectory, "0002_sample.sql"),
			"SELECT 2;",
		);
		vi.spyOn(process, "cwd").mockReturnValue(directory);
		query
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: [{ documents: "documents", vector_extension: true }],
			})
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [] });
		connect.mockResolvedValueOnce({ query, release });
		const { createDbRuntime } = await import("./index");
		const runtime = createDbRuntime({
			databaseUrl: "postgres://localhost/hono_standard",
		} as AppEnv);

		await expect(runtime.checkReady()).rejects.toThrow("pending");
		expect(query).toHaveBeenLastCalledWith("ROLLBACK");
		await runtime.close();
	});

	it("rejects readiness when the pgvector schema is unavailable", async () => {
		query
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: [{ documents: null, vector_extension: false }],
			})
			.mockResolvedValueOnce({ rows: [] });
		connect.mockResolvedValueOnce({ query, release });
		const { createDbRuntime } = await import("./index");
		const runtime = createDbRuntime({
			databaseUrl: "postgres://localhost/hono_standard",
		} as AppEnv);

		await expect(runtime.checkReady()).rejects.toThrow("pgvector schema");
		expect(query).toHaveBeenLastCalledWith("ROLLBACK");
		await runtime.close();
	});

	it("wraps external clients and handles connectivity", async () => {
		const { connectDb, wrapExternalClient } = await import("./index");
		const pool = new Pool();
		connect.mockResolvedValueOnce({ release });
		await connectDb(pool as never);
		expect(release).toHaveBeenCalledOnce();

		const client = new Client();
		connect.mockResolvedValueOnce(undefined);
		await connectDb(client as never);
		expect(wrapExternalClient(client as never).ownsConnection).toBe(false);
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
