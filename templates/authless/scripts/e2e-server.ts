import { spawnSync } from "node:child_process";

const appUrl = "http://127.0.0.1:5174";

Object.assign(process.env, {
	NODE_ENV: "development",
	PORT: "5174",
	DATABASE_URL:
		process.env.DATABASE_URL ??
		"postgres://postgres:postgres@localhost:5432/hono_standard",
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

run("bun", ["run", "build"]);

const { readAppEnv } = await import("../api/app/env");
const { runMigrations } = await import("../api/db/migrate");
const env = readAppEnv();
await runMigrations(env);
const { default: app, getAppRuntime } = await import("../api/app/hono");

const server = Bun.serve({
	fetch: app.fetch,
	hostname: env.host,
	port: env.port,
});

const shutdown = async () => {
	server.stop(true);
	const runtime = await getAppRuntime();
	await runtime.dbRuntime.close();
	process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
