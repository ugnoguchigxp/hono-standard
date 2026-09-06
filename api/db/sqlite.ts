import { Database } from "bun:sqlite";
import path from "node:path";
import { getTableColumns, getTableName, is, Table } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import type { AppEnv } from "../app/env";
import { createSingleWriterClient, type DatabaseClient } from "./client";
import { listSqlMigrations, MIGRATIONS_TABLE } from "./migrate-sqlite";
import { ensureDatabaseParentDirectory } from "./path";
import * as schema from "./schema";

export type AppDatabase = BunSQLiteDatabase<typeof schema>;
export type AppDatabaseClient = DatabaseClient<AppDatabase>;

export type DbRuntime = {
	client: AppDatabaseClient;
	checkReady: () => Promise<void>;
	close: () => Promise<void>;
};

function configureWriter(client: Database): void {
	client.run("PRAGMA journal_mode = WAL;");
	client.run("PRAGMA busy_timeout = 5000;");
	client.run("PRAGMA foreign_keys = ON;");
	// read-only connections cannot initialize WAL sidecar files themselves.
	client.query("SELECT count(*) FROM sqlite_schema").get();
}

function configureReader(client: Database): void {
	client.run("PRAGMA busy_timeout = 5000;");
	client.run("PRAGMA foreign_keys = ON;");
}

function isInMemoryDatabase(databasePath: string): boolean {
	return (
		databasePath === ":memory:" || databasePath.startsWith("file::memory:")
	);
}

function createWriterConnection(databasePath: string): {
	client: Database;
	db: AppDatabase;
} {
	ensureDatabaseParentDirectory(databasePath);
	const client = new Database(databasePath, { create: true });
	configureWriter(client);
	const db = drizzle(client, { schema });
	return { client, db };
}

function createReaderConnection(databasePath: string): {
	client: Database;
	db: AppDatabase;
} {
	const client = new Database(databasePath, { readonly: true });
	configureReader(client);
	const db = drizzle(client, { schema });
	return { client, db };
}

export function createSqliteDbRuntime(env: AppEnv): DbRuntime {
	const writerConnection = createWriterConnection(env.databaseUrl);
	const readerConnection = isInMemoryDatabase(env.databaseUrl)
		? writerConnection
		: createReaderConnection(env.databaseUrl);
	const writer = createSingleWriterClient(writerConnection.db);
	let closed = false;
	let readiness: Promise<void> | undefined;
	const checkReady = async () => {
		if (closed) throw new Error("Database is closing");
		const migrations = await listSqlMigrations(path.resolve("drizzle"));
		await writer.execute(async () => {
			const client = writerConnection.client;
			client.run("PRAGMA busy_timeout = 0");
			try {
				client.run("BEGIN IMMEDIATE");
				try {
					const applied = readerConnection.client
						.query(`SELECT filename FROM ${MIGRATIONS_TABLE}`)
						.all() as { filename: string }[];
					const names = new Set(applied.map((row) => row.filename));
					if (migrations.some((filename) => !names.has(filename))) {
						throw new Error("Database migrations are pending");
					}
					const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
					for (const table of Object.values(schema)) {
						if (!is(table, Table)) continue;
						const columns = Object.values(getTableColumns(table))
							.map((column) => `t.${quote(column.name)}`)
							.join(", ");
						readerConnection.client
							.query(
								`SELECT ${columns} FROM ${quote(getTableName(table))} AS t LIMIT 0`,
							)
							.all();
					}
				} finally {
					client.run("ROLLBACK");
				}
			} finally {
				client.run("PRAGMA busy_timeout = 5000");
			}
		});
	};

	return {
		// Reuse a queued probe so timed-out HTTP probes cannot flood the writer.
		checkReady: () => {
			readiness ??= checkReady().finally(() => {
				readiness = undefined;
			});
			return readiness;
		},
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

/**
 * 接続を確立する
 */
export async function connectDb(client: Database) {
	client.query("SELECT 1").get();
}
