import fs, { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app/env";

const { clients, createClient, drizzle, transaction, writer } = vi.hoisted(
	() => {
		const clients: Array<{
			execute: ReturnType<typeof vi.fn>;
			transaction: ReturnType<typeof vi.fn>;
			close: ReturnType<typeof vi.fn>;
		}> = [];
		const transaction = {
			execute: vi.fn(),
			rollback: vi.fn().mockResolvedValue(undefined),
		};
		const createClient = vi.fn(() => {
			const client = {
				execute: vi.fn().mockResolvedValue({}),
				transaction: vi.fn().mockResolvedValue(transaction),
				close: vi.fn(),
			};
			clients.push(client);
			return client;
		});
		return {
			clients,
			createClient,
			drizzle: vi.fn((client) => ({ client })),
			transaction,
			writer: {
				execute: vi.fn((operation) => operation({})),
				close: vi.fn().mockResolvedValue(undefined),
			},
		};
	},
);

vi.mock("@libsql/client", () => ({ createClient }));
vi.mock("drizzle-orm/libsql", () => ({ drizzle }));
vi.mock("./client", () => ({
	createSingleWriterClient: vi.fn(() => writer),
}));

describe("createDbRuntime", () => {
	const temporaryDirectories: string[] = [];

	beforeEach(() => {
		clients.length = 0;
		createClient.mockClear();
		drizzle.mockClear();
		writer.close.mockClear();
		writer.execute.mockClear();
		transaction.execute.mockReset();
		transaction.rollback.mockClear();
		transaction.execute.mockResolvedValue({ rows: [] });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		for (const directory of temporaryDirectories.splice(0)) {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});

	it("configures, probes, and closes one in-memory connection", async () => {
		const { createDbRuntime, connectDb, schema } = await import("./index");
		const runtime = await createDbRuntime({
			databaseUrl: ":memory:",
		} as AppEnv);

		expect(createClient).toHaveBeenCalledWith({
			url: ":memory:",
			authToken: undefined,
		});
		expect(clients).toHaveLength(1);
		await runtime.checkReady();
		await connectDb(clients[0] as never);
		await runtime.close();
		await runtime.close();
		expect(clients[0]?.close).toHaveBeenCalledOnce();
		expect(Object.keys(schema)).toEqual([]);
	});

	it("uses a query-only reader for a local file URL", async () => {
		const { createDbRuntime } = await import("./index");
		const directory = fs.mkdtempSync(
			path.join(os.tmpdir(), "hono-authless-runtime-"),
		);
		temporaryDirectories.push(directory);
		const runtime = await createDbRuntime({
			databaseUrl: `file:${path.join(directory, "data", "app.sqlite")}`,
			databaseAuthToken: "local-token",
		} as AppEnv);

		expect(clients).toHaveLength(2);
		expect(clients[1]?.execute).toHaveBeenCalledWith("PRAGMA query_only = ON");
		await runtime.close();
		expect(clients[0]?.close).toHaveBeenCalledOnce();
		expect(clients[1]?.close).toHaveBeenCalledOnce();
	});

	it("handles remote, empty, and in-memory file URLs", async () => {
		const { createDbRuntime } = await import("./index");
		const remote = await createDbRuntime({
			databaseUrl: "libsql://example.turso.io",
			databaseAuthToken: "remote-token",
		} as AppEnv);
		expect(clients[0]?.execute).not.toHaveBeenCalled();
		await remote.close();
		await expect(remote.checkReady()).rejects.toThrow("closed");

		await (await createDbRuntime({ databaseUrl: "file:" } as AppEnv)).close();
		await (
			await createDbRuntime({
				databaseUrl: "file::memory:?cache=shared",
			} as AppEnv)
		).close();
		await (
			await createDbRuntime({ databaseUrl: "file:app.sqlite" } as AppEnv)
		).close();
	});

	it("rolls back a failed readiness probe", async () => {
		const { createDbRuntime } = await import("./index");
		transaction.execute.mockRejectedValueOnce(new Error("ledger unavailable"));
		const runtime = await createDbRuntime({
			databaseUrl: "libsql://example.turso.io",
		} as AppEnv);
		await expect(runtime.checkReady()).rejects.toThrow("ledger unavailable");
		expect(transaction.rollback).toHaveBeenCalledOnce();
		await runtime.close();
	});

	it("rejects readiness while an added migration is pending", async () => {
		const directory = fs.mkdtempSync(
			path.join(os.tmpdir(), "hono-authless-readiness-"),
		);
		temporaryDirectories.push(directory);
		const migrationsDirectory = path.join(directory, "drizzle");
		mkdirSync(migrationsDirectory);
		writeFileSync(
			path.join(migrationsDirectory, "0001_sample.sql"),
			"SELECT 1;",
		);
		vi.spyOn(process, "cwd").mockReturnValue(directory);

		const { createDbRuntime } = await import("./index");
		const runtime = await createDbRuntime({
			databaseUrl: "libsql://example.turso.io",
		} as AppEnv);
		await expect(runtime.checkReady()).rejects.toThrow("pending");
		await runtime.close();
	});
});
