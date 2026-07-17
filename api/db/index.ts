import type { AppEnv } from "../app/env";
import * as schema from "./schema";
import { createSqliteDbRuntime, type DbRuntime } from "./sqlite";

export {
	createSingleWriterClient,
	type DatabaseClient,
	type DatabaseWriter,
	type ReadDatabase,
} from "./client";
export {
	type AppDatabase,
	type AppDatabaseClient,
	connectDb,
	createSqliteDbRuntime,
	type DbRuntime,
} from "./sqlite";

export function createDbRuntime(env: AppEnv): DbRuntime {
	return createSqliteDbRuntime(env);
}

export { schema };
