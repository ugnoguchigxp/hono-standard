import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const databasePath = "data/e2e.sqlite";
const databaseUrl = `file:${databasePath}`;
const appUrl = "http://127.0.0.1:5174";

Object.assign(process.env, {
	NODE_ENV: "development",
	PORT: "5174",
	DATABASE_URL: databaseUrl,
	DATABASE_AUTH_TOKEN: "",
	APP_URL: appUrl,
	CORS_ORIGINS: appUrl,
	SECURITY_HEADERS_MODE: "auto",
});

function run(command: string, args: string[]) {
	const result = spawnSync(command, args, {
		stdio: "inherit",
		env: process.env,
	});
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error(`${command} ${args.join(" ")} failed.`);
}

rmSync(databasePath, { force: true });
rmSync(`${databasePath}-shm`, { force: true });
rmSync(`${databasePath}-wal`, { force: true });
run("bun", ["run", "build"]);

const { readAppEnv } = await import("../api/app/env");
const { runMigrations } = await import("../api/db/migrate");
const env = readAppEnv();
await runMigrations(env);
const { default: app } = await import("../api/app/hono");

const server = Bun.serve({
	fetch: app.fetch,
	hostname: env.host,
	port: env.port,
});

const { bindHttpServerSignals, toHttpServer } = await import(
	"../api/app/server"
);
bindHttpServerSignals(toHttpServer(server, env.port));
