import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const appUrl = "http://127.0.0.1:5174";
const composeFile = "docker-compose.e2e.yml";
const composeProject = `hono-standard-rag-e2e-${process.pid}`;
const contentRoot = "data/e2e-wiki";
const composeProjectFile = "data/e2e-compose-project";

function run(
	command: string,
	args: string[],
	options: { capture?: boolean } = {},
): string {
	const result = spawnSync(command, args, {
		stdio: options.capture ? "pipe" : "inherit",
		encoding: "utf8",
		env: process.env,
	});
	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(" ")} failed.`);
	}
	return options.capture ? result.stdout.trim() : "";
}

const composeArgs = ["compose", "-f", composeFile, "-p", composeProject];
let composeStarted = false;

function stopComposeProject(project: string): void {
	spawnSync(
		"docker",
		[
			"compose",
			"-f",
			composeFile,
			"-p",
			project,
			"down",
			"--volumes",
			"--remove-orphans",
		],
		{
			stdio: "inherit",
			env: process.env,
		},
	);
}

function stopDatabase(): void {
	if (!composeStarted) return;
	stopComposeProject(composeProject);
	rmSync(composeProjectFile, { force: true });
	composeStarted = false;
}

try {
	if (existsSync(composeProjectFile)) {
		const staleProject = readFileSync(composeProjectFile, "utf8").trim();
		if (staleProject) stopComposeProject(staleProject);
		rmSync(composeProjectFile, { force: true });
	}
	rmSync(contentRoot, { force: true, recursive: true });
	run("docker", [...composeArgs, "up", "-d", "--wait"]);
	composeStarted = true;
	writeFileSync(composeProjectFile, composeProject);

	const portOutput = run("docker", [...composeArgs, "port", "db", "5432"], {
		capture: true,
	});
	const databasePort = portOutput.match(/:(\d+)\s*$/)?.[1];
	if (!databasePort) {
		throw new Error(
			`Could not resolve E2E PostgreSQL port from: ${portOutput}`,
		);
	}

	process.env.NODE_ENV = "development";
	process.env.HOST = "127.0.0.1";
	process.env.PORT = "5174";
	process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${databasePort}/hono_standard_e2e`;
	process.env.CONTENT_ROOT = contentRoot;
	process.env.WIKI_STORAGE_BACKEND = "local";
	process.env.JWT_SECRET = "hono-standard-e2e-jwt-secret-change-this";
	process.env.APP_URL = appUrl;
	process.env.CORS_ORIGINS = appUrl;
	process.env.AUTH_COOKIE_SECURE = "false";
	process.env.AUTH_COOKIE_SAME_SITE = "lax";
	process.env.SECURITY_HEADERS_MODE = "auto";

	run("bun", ["run", "build"]);
} catch (error) {
	stopDatabase();
	throw error;
}

const { readAppEnv } = await import("../api/app/env");
const { runMigrations } = await import("../api/db/migrate");
const { createDbConnection } = await import("../api/db");
const { AuthService } = await import("../api/modules/auth/auth.service");

const env = readAppEnv();
await runMigrations(env);

const seedConnection = createDbConnection(env.databaseUrl);
try {
	const authService = new AuthService(seedConnection.db, env);
	await authService.createAdmin({
		email: "admin@example.com",
		displayName: "Admin User",
		password: "password123456",
	});
} finally {
	if ("end" in seedConnection.pgClient) {
		await seedConnection.pgClient.end();
	}
}

const { default: app, getAppRuntime } = await import("../api/app/hono");

const server = Bun.serve({
	fetch: app.fetch,
	hostname: env.host,
	port: env.port,
});

console.log(`E2E server listening on http://${env.host}:${server.port}`);

let shuttingDown = false;
const shutdown = async () => {
	if (shuttingDown) return;
	shuttingDown = true;
	server.stop(true);
	try {
		const runtime = await getAppRuntime();
		if (
			runtime.dbConnection.ownsConnection &&
			"end" in runtime.dbConnection.pgClient
		) {
			await runtime.dbConnection.pgClient.end();
		}
	} finally {
		stopDatabase();
		rmSync(contentRoot, { force: true, recursive: true });
	}
	process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
