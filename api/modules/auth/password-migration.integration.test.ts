import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

it("upgrades a persisted legacy password without changing it on failed or subsequent logins", () => {
	const root = mkdtempSync(path.join(tmpdir(), "hono-password-migration-"));
	try {
		const result = spawnSync(
			"bun",
			[
				"-e",
				`
			import assert from "node:assert/strict";
			import { scryptSync } from "node:crypto";
			import { eq } from "drizzle-orm";
			import { readAppEnv } from "./api/app/env";
			import { runMigrations } from "./api/db/migrate";
			import { createDbRuntime } from "./api/db";
			import { users } from "./api/db/schema";
			import { AuthService } from "./api/modules/auth/auth.service";
			import { hashPassword, verifyPassword } from "./api/modules/auth/password";
			const env = readAppEnv();
			await runMigrations(env);
			const runtime = createDbRuntime(env);
			try {
				const service = new AuthService(runtime.client, env);
				const credentials = { email: "legacy@example.com", password: "legacy-password" };
				const user = await service.createAdmin({ ...credentials, displayName: "Legacy User" });
				const salt = "12".repeat(16);
				const legacy = "s1$" + salt + "$" + scryptSync(credentials.password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
				await runtime.client.write.execute(db => db.update(users).set({ passwordHash: legacy }).where(eq(users.id, user.id)));
				await assert.rejects(service.login({ ...credentials, password: "wrong" }));
				assert.equal((await service.findUserById(user.id)).passwordHash, legacy);
				await Promise.all([service.login(credentials), service.login(credentials)]);
				const upgraded = (await service.findUserById(user.id)).passwordHash;
				assert.ok(upgraded.startsWith("s2$"));
				assert.ok(await verifyPassword(credentials.password, upgraded));
				await service.login(credentials);
				assert.equal((await service.findUserById(user.id)).passwordHash, upgraded);
				// A reset that wins between verification and the upgrade write must survive.
				await runtime.client.write.execute(db => db.update(users).set({ passwordHash: legacy }).where(eq(users.id, user.id)));
				const replacement = await hashPassword("replacement-password");
				let resetPending = true;
				const racingService = new AuthService({ ...runtime.client, write: {
					...runtime.client.write,
					execute: async operation => {
						if (resetPending) {
							resetPending = false;
							await runtime.client.write.execute(db => db.update(users).set({ passwordHash: replacement }).where(eq(users.id, user.id)));
						}
						return runtime.client.write.execute(operation);
					},
				}}, env);
				await racingService.login(credentials);
				assert.equal((await service.findUserById(user.id)).passwordHash, replacement);
			} finally { await runtime.close(); }
		`,
			],
			{
				encoding: "utf8",
				env: {
					...process.env,
					NODE_ENV: "test",
					DATABASE_URL: path.join(root, "auth.sqlite"),
					JWT_SECRET: "password-migration-test-secret-12345",
				},
			},
		);
		expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}, 15_000);
