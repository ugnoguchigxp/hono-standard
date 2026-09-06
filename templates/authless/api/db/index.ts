import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { type Client, Pool, type PoolClient } from "pg";
import type { AppEnv } from "../app/env";
import { createSingleWriterClient, type DatabaseClient } from "./client";
import * as schema from "./schema";

export type AppDatabase = NodePgDatabase<typeof schema>;
export type AppDatabaseClient = DatabaseClient<AppDatabase>;

export type DbConnection = {
	pgClient: Client | Pool;
	db: AppDatabase;
	ownsConnection: boolean;
};

export type DbRuntime = {
	client: AppDatabaseClient;
	db: AppDatabase;
	checkReady: () => Promise<void>;
	close: () => Promise<void>;
	connection: DbConnection;
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

async function probeConnection(connection: DbConnection): Promise<void> {
	const expected = await expectedMigrations();
	const acquired =
		connection.pgClient instanceof Pool
			? await connection.pgClient.connect()
			: connection.pgClient;
	const client = acquired as Client | PoolClient;
	let began = false;
	try {
		await client.query("BEGIN READ WRITE");
		began = true;
		await client.query("SELECT 1");
		const schemaResult = await client.query<{
			documents: string | null;
			vector_extension: boolean;
		}>(
			"SELECT to_regclass('public.documents')::text AS documents, EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS vector_extension",
		);
		if (
			!schemaResult.rows[0]?.documents ||
			!schemaResult.rows[0]?.vector_extension
		) {
			throw new Error("Required pgvector schema is missing");
		}
		const migrations = await client.query<{ filename: string }>(
			`SELECT filename FROM ${MIGRATIONS_TABLE}`,
		);
		const applied = new Set(migrations.rows.map((row) => row.filename));
		const pending = expected.filter((filename) => !applied.has(filename));
		if (pending.length > 0) throw new Error("Database migrations are pending");
		await client.query("ROLLBACK");
		began = false;
	} finally {
		if (began) await client.query("ROLLBACK").catch(() => undefined);
		if (connection.pgClient instanceof Pool) {
			(acquired as PoolClient).release();
		}
	}
}

export function createDbConnection(databaseUrl: string): DbConnection {
	const pool = new Pool({ connectionString: databaseUrl });
	const db = drizzle(pool, { schema });
	return { pgClient: pool, db, ownsConnection: true };
}

export function wrapExternalClient(pgClient: Client | Pool): DbConnection {
	const db = drizzle(pgClient, { schema });
	return { pgClient, db, ownsConnection: false };
}

export function createDbRuntime(env: AppEnv): DbRuntime {
	const connection = createDbConnection(env.databaseUrl);
	const writer = createSingleWriterClient(connection.db);
	let closed = false;
	let readinessProbe: Promise<void> | undefined;
	return {
		client: {
			read: connection.db,
			write: writer,
		},
		db: connection.db,
		connection,
		checkReady: () => {
			if (closed)
				return Promise.reject(new Error("Database runtime is closed"));
			readinessProbe ??= probeConnection(connection).finally(() => {
				readinessProbe = undefined;
			});
			return readinessProbe;
		},
		close: async () => {
			if (closed) return;
			closed = true;
			await writer.close();
			if (connection.ownsConnection && connection.pgClient instanceof Pool) {
				await connection.pgClient.end();
			}
		},
	};
}

export async function connectDb(pgClient: Client | Pool) {
	if (pgClient instanceof Pool) {
		const client = await pgClient.connect();
		client.release();
		return;
	}
	try {
		await pgClient.connect();
	} catch (error) {
		if (
			error instanceof Error &&
			error.message.includes("Client has already been connected")
		) {
			return;
		}
		throw error;
	}
}

export {
	createSingleWriterClient,
	type DatabaseClient,
	type DatabaseWriter,
} from "./client";
export { schema };
