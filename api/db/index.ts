import type { AppEnv } from "../app/env";
import * as schema from "./schema";
import { createSqliteDbRuntime, type DbRuntime } from "./sqlite";
export {
	connectDb,
	createDbConnection,
	createSqliteDbRuntime,
	wrapExternalClient,
	type AppDatabase,
	type DbConnection,
	type DbRuntime,
} from "./sqlite";

export function createDbRuntime(env: AppEnv): DbRuntime {
	return createSqliteDbRuntime(env);
}

export { schema };
