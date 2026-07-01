import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { type Client, Pool } from "pg";
import * as schema from "./schema";
import type { AppEnv } from "../app/env";

export type AppDatabase = NodePgDatabase<typeof schema>;

export type DbConnection = {
	pgClient: Client | Pool;
	db: AppDatabase;
	/** このパッケージが接続を所有しているか（close責任があるか） */
	ownsConnection: boolean;
};

export type DbRuntime = {
	db: AppDatabase;
	close: () => Promise<void>;
	connection: DbConnection;
};

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
	return {
		db: connection.db,
		connection,
		close: async () => {
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

export { schema };
