import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

it("restores migrated application data and can log in and read a protected profile", () => {
	const directory = mkdtempSync(path.join(tmpdir(), "hono-auth-recovery-"));
	try {
		const result = spawnSync(
			"bun",
			[
				"-e",
				`
import assert from "node:assert/strict";
import { readAppEnv } from "./api/app/env.ts";
import { createDbRuntime } from "./api/db/index.ts";
import { runSqliteMigrations } from "./api/db/migrate-sqlite.ts";
import { AuthService } from "./api/modules/auth/auth.service.ts";
import { backupDatabase, restoreDatabase } from "./scripts/db-snapshot.ts";
const env = readAppEnv();
await runSqliteMigrations(env);
const source = createDbRuntime(env);
const credentials = { email: "recovery@example.com", password: "recovery-test-password-2026" };
await new AuthService(source.client, env).createAdmin({ ...credentials, displayName: "Recovered User" });
const snapshot = process.env.RECOVERY_TEST_DIR + "/backup.sqlite";
const restored = process.env.RECOVERY_TEST_DIR + "/restored.sqlite";
await backupDatabase(env.databaseUrl, snapshot);
await source.close();
await restoreDatabase(snapshot, restored);
process.env.DATABASE_URL = restored;
await runSqliteMigrations(readAppEnv());
const { default: app, getAppRuntime } = await import("./api/app/hono.ts");
try {
 assert.equal((await app.request("/api/ready")).status, 200);
 const response = await app.request("http://localhost:5173/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" }, body: JSON.stringify(credentials) });
 assert.equal(response.status, 200);
 const cookies = response.headers.getSetCookie().map(cookie => cookie.split(";")[0]).join("; ");
 const profile = await app.request("/api/protected/profile", { headers: { Cookie: cookies } });
 assert.equal(profile.status, 200);
 assert.ok((await profile.text()).includes("recovery@example.com"));
} finally { await (await getAppRuntime()).dbRuntime.close(); }
`,
			],
			{
				encoding: "utf8",
				env: {
					...process.env,
					NODE_ENV: "test",
					DATABASE_URL: path.join(directory, "source.sqlite"),
					RECOVERY_TEST_DIR: directory,
					JWT_SECRET: "hono-recovery-test-secret-32-characters",
					APP_URL: "http://localhost:5173",
					CORS_ORIGINS: "http://localhost:5173",
					AUTH_COOKIE_SECURE: "false",
				},
				timeout: 10_000,
			},
		);
		expect(result.status, result.stderr).toBe(0);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
