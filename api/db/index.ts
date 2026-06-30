import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { drizzle } from "drizzle-orm/libsql";

import type { AppEnv } from "../app/env";
import * as schema from "./schema";

export type AppDatabase = LibSQLDatabase<typeof schema>;

export type DbConnection = {
	client: Client;
	db: AppDatabase;
	/** このパッケージが接続を所有しているか（close責任があるか） */
	ownsConnection: boolean;
};

export type DbRuntime = {
	db: AppDatabase;
	close: () => void;
	connection: DbConnection;
};

function ensureLocalLibsqlParentDirectory(databaseUrl: string): void {
	if (!databaseUrl.startsWith("file:")) return;
	const databasePath = databaseUrl.slice("file:".length);
	if (!databasePath || databasePath === ":memory:") return;
	const parentDirectory = path.dirname(databasePath);
	if (parentDirectory === ".") return;
	fs.mkdirSync(parentDirectory, { recursive: true });
}

/**
 * databaseUrl から新しい libSQL client を作成してDrizzleでラップする
 * 接続の所有権はこのパッケージに帰属する
 */
export function createDbConnection(
	databaseUrl: string,
	authToken?: string,
): DbConnection {
	ensureLocalLibsqlParentDirectory(databaseUrl);
	const client = createClient({
		url: databaseUrl,
		authToken,
	});
	const db = drizzle(client, { schema });
	return { client, db, ownsConnection: true };
}

/**
 * 外部の libSQL client をDrizzleでラップする
 * 接続の所有権はホスト側に帰属（closeしない）
 */
export function wrapExternalClient(client: Client): DbConnection {
	const db = drizzle(client, { schema });
	return { client, db, ownsConnection: false };
}

export function createDbRuntime(env: AppEnv): DbRuntime {
	const connection = createDbConnection(env.databaseUrl, env.databaseAuthToken);
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
export async function connectDb(client: Client) {
	await client.execute("SELECT 1");
}

export { schema };
