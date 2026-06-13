import { createClient, type Client } from "@libsql/client";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

export type DbConnection = {
	client: Client;
	db: LibSQLDatabase<typeof schema>;
	/** このパッケージが接続を所有しているか（close責任があるか） */
	ownsConnection: boolean;
};

/**
 * databaseUrl から新しい libSQL client を作成してDrizzleでラップする
 * 接続の所有権はこのパッケージに帰属する
 */
export function createDbConnection(
	databaseUrl: string,
	authToken?: string,
): DbConnection {
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

/**
 * 接続を確立する
 */
export async function connectDb(client: Client) {
	await client.execute("SELECT 1");
}

export { schema };
