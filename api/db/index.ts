import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { type Client, Pool, type PoolClient } from "pg";
import * as schema from "./schema";
import type { AppEnv } from "../app/env";
import { createSingleWriterClient, type DatabaseClient } from "./client";

export type AppDatabase = NodePgDatabase<typeof schema>;
export type AppDatabaseClient = DatabaseClient<AppDatabase>;

export type DbConnection = {
	pgClient: Client | Pool;
	db: AppDatabase;
	/** このパッケージが接続を所有しているか（close責任があるか） */
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
			users: string | null;
			refresh_tokens: string | null;
			sources: string | null;
			source_fragments: string | null;
			conversations: string | null;
			messages: string | null;
			artifacts: string | null;
			retrieval_logs: string | null;
			user_settings: string | null;
			vector_extension: boolean;
			trigram_extension: boolean;
		}>(
			"SELECT to_regclass('public.users')::text AS users, to_regclass('public.refresh_tokens')::text AS refresh_tokens, to_regclass('public.sources')::text AS sources, to_regclass('public.source_fragments')::text AS source_fragments, to_regclass('public.conversations')::text AS conversations, to_regclass('public.messages')::text AS messages, to_regclass('public.artifacts')::text AS artifacts, to_regclass('public.retrieval_logs')::text AS retrieval_logs, to_regclass('public.user_settings')::text AS user_settings, EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS vector_extension, EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS trigram_extension",
		);
		if (
			!schemaResult.rows[0]?.users ||
			!schemaResult.rows[0]?.refresh_tokens ||
			!schemaResult.rows[0]?.sources ||
			!schemaResult.rows[0]?.source_fragments ||
			!schemaResult.rows[0]?.conversations ||
			!schemaResult.rows[0]?.messages ||
			!schemaResult.rows[0]?.artifacts ||
			!schemaResult.rows[0]?.retrieval_logs ||
			!schemaResult.rows[0]?.user_settings ||
			!schemaResult.rows[0]?.vector_extension ||
			!schemaResult.rows[0]?.trigram_extension
		) {
			throw new Error("Required database tables are missing");
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
