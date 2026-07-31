import { readAppEnv } from "../app/env";
import { runMigrations } from "../db/migrate";

const result = await runMigrations(readAppEnv(), { log: console.log });
console.log(JSON.stringify(result, null, 2));
