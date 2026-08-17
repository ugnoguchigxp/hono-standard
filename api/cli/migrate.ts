import { readAppEnv } from "../app/env";
import { runMigrations } from "../db/migrate";

export async function runMigrateCli(
	options: {
		readEnv?: typeof readAppEnv;
		migrate?: typeof runMigrations;
		write?: (message: string) => void;
	} = {},
) {
	const readEnv = options.readEnv ?? readAppEnv;
	const migrate = options.migrate ?? runMigrations;
	const write = options.write ?? console.log;
	const env = readEnv();
	const result = await migrate(env);
	write(JSON.stringify(result, null, 2));
	return result;
}

if (import.meta.main) {
	await runMigrateCli();
}
