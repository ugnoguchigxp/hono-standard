import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";

const port = process.env.E2E_PORT ?? "5174";
const appUrl = `http://127.0.0.1:${port}`;
const databaseUrl =
	process.env.E2E_DATABASE_URL ??
	path.join(
		mkdtempSync(path.join(tmpdir(), "hono-standard-e2e-")),
		"e2e.sqlite",
	);

if (existsSync(databaseUrl)) {
	throw new Error(
		`Refusing to overwrite the existing E2E database at ${databaseUrl}.`,
	);
}
mkdirSync(path.dirname(databaseUrl), { recursive: true });

process.env.NODE_ENV = "development";
process.env.PORT = port;
process.env.DATABASE_URL = databaseUrl;
process.env.JWT_SECRET = "hono-standard-e2e-jwt-secret-change-this";
process.env.APP_URL = appUrl;
process.env.CORS_ORIGINS = appUrl;
process.env.AUTH_COOKIE_SECURE = "false";
process.env.AUTH_COOKIE_SAME_SITE = "lax";
process.env.SECURITY_HEADERS_MODE = "auto";

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

run("bun", ["run", "build"]);

const { readAppEnv } = await import("../api/app/env");
const { runMigrations } = await import("../api/db/migrate");
const { createDbRuntime } = await import("../api/db");
const { AuthService } = await import("../api/modules/auth/auth.service");

const env = readAppEnv();
await runMigrations(env);

const dbRuntime = createDbRuntime(env);
try {
	const authService = new AuthService(dbRuntime.client, env);
	await authService.createAdmin({
		email: "admin@example.com",
		displayName: "Admin User",
		password: "password123456",
	});
	await authService.createAdmin({
		email: "second@example.com",
		displayName: "Second User",
		password: "password123456",
	});
} finally {
	await dbRuntime.close();
}

const { default: app } = await import("../api/app/hono");

const server = Bun.serve({
	fetch: app.fetch,
	hostname: env.host,
	port: env.port,
});

console.log(`E2E server listening on http://${env.host}:${server.port}`);

const { bindHttpServerSignals, toHttpServer } = await import(
	"../api/app/server"
);
bindHttpServerSignals(toHttpServer(server, env.port));
