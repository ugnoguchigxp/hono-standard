import fs from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { drizzle } from "drizzle-orm/libsql";

import type { AppEnv } from "../app/env";
import { createSingleWriterClient, type DatabaseClient } from "./client";
import * as schema from "./schema";

export {
	createSingleWriterClient,
	type DatabaseClient,
	type DatabaseWriter,
} from "./client";

export type AppDatabase = LibSQLDatabase<typeof schema>;
export type AppDatabaseClient = DatabaseClient<AppDatabase>;

type DbConnection = {
	client: Client;
	db: AppDatabase;
};

export type DbRuntime = {
	client: AppDatabaseClient;
	checkReady: () => Promise<void>;
	close: () => Promise<void>;
};

const MIGRATIONS_TABLE = "hono_standard_schema_migrations";

async function expectedMigrations(): Promise<string[]> {
	const entries = await readdir(path.resolve(process.cwd(), "drizzle"), {
		withFileTypes: true,
	});
	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b));
}

async function probeConnection(client: Client): Promise<void> {
	const expected = await expectedMigrations();
	const transaction = await client.transaction("write");
	try {
		await transaction.execute("SELECT 1");
		const tables = await transaction.execute(
			"SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN ('users', 'refresh_tokens')",
		);
		const tableNames = new Set(tables.rows.map((row) => String(row.name)));
		if (!tableNames.has("users") || !tableNames.has("refresh_tokens")) {
			throw new Error("Required database tables are missing");
		}
		const migrations = await transaction.execute(
			`SELECT filename FROM ${MIGRATIONS_TABLE}`,
		);
		const applied = new Set(migrations.rows.map((row) => String(row.filename)));
		if (expected.some((filename) => !applied.has(filename))) {
			throw new Error("Database migrations are pending");
		}
	} finally {
		await transaction.rollback();
	}
}

function isLocalFileDatabase(databaseUrl: string): boolean {
	return databaseUrl === ":memory:" || databaseUrl.startsWith("file:");
}

function isInMemoryDatabase(databaseUrl: string): boolean {
	return databaseUrl === ":memory:" || databaseUrl.startsWith("file::memory:");
}

function ensureLocalLibsqlParentDirectory(databaseUrl: string): void {
	if (!databaseUrl.startsWith("file:")) return;
	const databasePath = databaseUrl.slice("file:".length);
	if (!databasePath || databasePath.startsWith(":memory:")) return;
	const parentDirectory = path.dirname(databasePath);
	if (parentDirectory === ".") return;
	fs.mkdirSync(parentDirectory, { recursive: true });
}

function createDbConnection(
	databaseUrl: string,
	authToken?: string,
): DbConnection {
	ensureLocalLibsqlParentDirectory(databaseUrl);
	const client = createClient({
		url: databaseUrl,
		authToken,
	});
	const db = drizzle(client, { schema });
	return { client, db };
}

async function configureLocalWriter(client: Client): Promise<void> {
	await client.execute("PRAGMA journal_mode = WAL");
	await client.execute("PRAGMA busy_timeout = 5000");
	await client.execute("PRAGMA foreign_keys = ON");
	await client.execute("SELECT count(*) FROM sqlite_schema");
}

async function configureLocalReader(client: Client): Promise<void> {
	await client.execute("PRAGMA busy_timeout = 5000");
	await client.execute("PRAGMA foreign_keys = ON");
	await client.execute("PRAGMA query_only = ON");
}

export async function createDbRuntime(env: AppEnv): Promise<DbRuntime> {
	const writerConnection = createDbConnection(
		env.databaseUrl,
		env.databaseAuthToken,
	);
	const localFile = isLocalFileDatabase(env.databaseUrl);
	if (localFile) {
		await configureLocalWriter(writerConnection.client);
	}

	const readerConnection =
		localFile && !isInMemoryDatabase(env.databaseUrl)
			? createDbConnection(env.databaseUrl, env.databaseAuthToken)
			: writerConnection;
	if (readerConnection !== writerConnection) {
		await configureLocalReader(readerConnection.client);
	}

	const writer = createSingleWriterClient(writerConnection.db);
	let closed = false;
	let readinessProbe: Promise<void> | undefined;

	return {
		client: {
			read: readerConnection.db,
			write: writer,
		},
		checkReady: () => {
			if (closed)
				return Promise.reject(new Error("Database runtime is closed"));
			readinessProbe ??= writer
				.execute(() => probeConnection(writerConnection.client))
				.finally(() => {
					readinessProbe = undefined;
				});
			return readinessProbe;
		},
		close: async () => {
			if (closed) return;
			closed = true;
			await writer.close();
			if (readerConnection !== writerConnection) {
				readerConnection.client.close();
			}
			writerConnection.client.close();
		},
	};
}

export async function connectDb(client: Client) {
	await client.execute("SELECT 1");
}

export { schema };
