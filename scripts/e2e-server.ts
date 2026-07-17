import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const e2ePort = process.env.E2E_PORT ?? "5174";
const databaseUrl =
	process.env.E2E_DATABASE_URL ?? `data/e2e-${e2ePort}.sqlite`;
const distWebRoot = `dist/e2e-${e2ePort}/web`;
const appUrl = `http://127.0.0.1:${e2ePort}`;

process.env.NODE_ENV = "development";
process.env.PORT = e2ePort;
process.env.DATABASE_URL = databaseUrl;
process.env.DIST_WEB_ROOT = distWebRoot;
process.env.VITE_OUT_DIR = `../${distWebRoot}`;
process.env.JWT_SECRET = "hono-standard-e2e-jwt-secret-change-this";
process.env.APP_URL = appUrl;
process.env.CORS_ORIGINS = appUrl;
process.env.AUTH_COOKIE_SECURE = "false";
process.env.AUTH_COOKIE_SAME_SITE = "lax";
process.env.SECURITY_HEADERS_MODE = "auto";
process.env.VITE_E2E_INSPECTOR =
	process.env.E2E_INSPECTOR === "1" ? "true" : "false";

function run(command: string, args: string[]) {
	const result = spawnSync(command, args, {
		stdio: "inherit",
		env: process.env,
	});
	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(" ")} failed.`);
	}
}

rmSync(databaseUrl, { force: true });
rmSync(`${databaseUrl}-shm`, { force: true });
rmSync(`${databaseUrl}-wal`, { force: true });

run("bun", ["run", "build"]);

const { readAppEnv } = await import("../api/app/env");
const { runMigrations } = await import("../api/db/migrate");

const env = readAppEnv();
await runMigrations(env);
run("bun", ["run", "seed:dev"]);

const { default: app, getAppRuntime } = await import("../api/app/hono");

const server = Bun.serve({
	fetch: app.fetch,
	hostname: env.host,
	port: env.port,
});

console.log(`E2E server listening on http://${env.host}:${server.port}`);

const shutdown = async () => {
	server.stop(true);
	const runtime = await getAppRuntime();
	await runtime.dbRuntime.close();
	process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
