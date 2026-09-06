import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error(
		"DATABASE_URL is required. Run `bun run bootstrap` before E2E tests.",
	);
}
const appUrl = "http://127.0.0.1:5174";

process.env.NODE_ENV = "development";
process.env.PORT = "5174";
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
	const existingAdmin = await authService.findUserByEmail("admin@example.com");
	if (!existingAdmin) {
		await authService.createAdmin({
			email: "admin@example.com",
			displayName: "Admin User",
			password: "password123456",
		});
	}
	const existingSecond =
		await authService.findUserByEmail("second@example.com");
	if (!existingSecond) {
		await authService.createAdmin({
			email: "second@example.com",
			displayName: "Second User",
			password: "password123456",
		});
	}
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
