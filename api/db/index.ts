import fs from "node:fs";
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
	close: () => Promise<void>;
};

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

	return {
		client: {
			read: readerConnection.db,
			write: writer,
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
