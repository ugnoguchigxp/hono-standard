import { Database } from "bun:sqlite";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import type { AppEnv } from "../app/env";
import { ensureDatabaseParentDirectory } from "./path";
import * as schema from "./schema";

export type AppDatabase = BunSQLiteDatabase<typeof schema>;

export type DbConnection = {
	client: Database;
	db: AppDatabase;
	/** このパッケージが接続を所有しているか（close責任があるか） */
	ownsConnection: boolean;
};

export type DbRuntime = {
	db: AppDatabase;
	close: () => void;
	connection: DbConnection;
};

/**
 * databasePath から新しい SQLite database を作成してDrizzleでラップする
 * 接続の所有権はこのパッケージに帰属する
 */
export function createDbConnection(databasePath: string): DbConnection {
	ensureDatabaseParentDirectory(databasePath);
	const client = new Database(databasePath, { create: true });
	const db = drizzle(client, { schema });
	return { client, db, ownsConnection: true };
}

/**
 * 外部の SQLite database をDrizzleでラップする
 * 接続の所有権はホスト側に帰属（closeしない）
 */
export function wrapExternalClient(client: Database): DbConnection {
	const db = drizzle(client, { schema });
	return { client, db, ownsConnection: false };
}

export function createSqliteDbRuntime(env: AppEnv): DbRuntime {
	const connection = createDbConnection(env.databaseUrl);
	return {
		db: connection.db,
		connection,
		close: () => {
			if (connection.ownsConnection) {
				connection.client.close();
			}
		},
	};
}

/**
 * 接続を確立する
 */
export async function connectDb(client: Database) {
	client.query("SELECT 1").get();
}
