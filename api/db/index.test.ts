import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app/env";

const { clients, createClient, drizzle, writer } = vi.hoisted(() => {
	const clients: Array<{
		execute: ReturnType<typeof vi.fn>;
		close: ReturnType<typeof vi.fn>;
	}> = [];
	const createClient = vi.fn(() => {
		const client = { execute: vi.fn().mockResolvedValue({}), close: vi.fn() };
		clients.push(client);
		return client;
	});
	return {
		clients,
		createClient,
		drizzle: vi.fn((client) => ({ client })),
		writer: { close: vi.fn().mockResolvedValue(undefined) },
	};
});

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
	});

	afterEach(() => {
		for (const directory of temporaryDirectories.splice(0)) {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});

	it("configures and closes one in-memory connection", async () => {
		const { createDbRuntime, connectDb, schema } = await import("./index");
		const runtime = await createDbRuntime({
			databaseUrl: ":memory:",
		} as AppEnv);

		expect(createClient).toHaveBeenCalledWith({
			url: ":memory:",
			authToken: undefined,
		});
		expect(clients).toHaveLength(1);
		expect(clients[0]?.execute).toHaveBeenCalledWith(
			"PRAGMA journal_mode = WAL",
		);
		await connectDb(clients[0] as never);
		await runtime.close();
		await runtime.close();
		expect(clients[0]?.close).toHaveBeenCalledOnce();
		expect(schema.users).toBeDefined();
	});

	it("uses a query-only reader for a local file URL", async () => {
		const { createDbRuntime } = await import("./index");
		const directory = fs.mkdtempSync(
			path.join(os.tmpdir(), "hono-libsql-runtime-"),
		);
		temporaryDirectories.push(directory);
		const databaseUrl = `file:${path.join(directory, "data", "app.sqlite")}`;
		const runtime = await createDbRuntime({
			databaseUrl,
			databaseAuthToken: "local-token",
		} as AppEnv);

		expect(clients).toHaveLength(2);
		expect(clients[1]?.execute).toHaveBeenCalledWith("PRAGMA query_only = ON");
		expect(fs.existsSync(path.join(directory, "data"))).toBe(true);
		await runtime.close();
		expect(clients[0]?.close).toHaveBeenCalledOnce();
		expect(clients[1]?.close).toHaveBeenCalledOnce();
	});

	it("does not configure remote libSQL connections", async () => {
		const { createDbRuntime } = await import("./index");
		const runtime = await createDbRuntime({
			databaseUrl: "libsql://example.turso.io",
			databaseAuthToken: "remote-token",
		} as AppEnv);

		expect(clients).toHaveLength(1);
		expect(clients[0]?.execute).not.toHaveBeenCalled();
		await runtime.close();
	});

	it("accepts empty and in-memory file URL forms without making directories", async () => {
		const { createDbRuntime } = await import("./index");

		const emptyPathRuntime = await createDbRuntime({
			databaseUrl: "file:",
		} as AppEnv);
		await emptyPathRuntime.close();

		const inMemoryRuntime = await createDbRuntime({
			databaseUrl: "file::memory:?cache=shared",
		} as AppEnv);
		await inMemoryRuntime.close();

		const relativePathRuntime = await createDbRuntime({
			databaseUrl: "file:app.sqlite",
		} as AppEnv);
		await relativePathRuntime.close();
	});
});
