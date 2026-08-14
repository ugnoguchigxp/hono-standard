import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("refresh token rotation", () => {
	it("detects reuse and revokes the active token family", () => {
		const email = `refresh-${randomUUID()}@example.com`;
		const script = `
			process.env.NODE_ENV = "test";
			process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
			process.env.JWT_SECRET = "refresh-rotation-integration-secret";
			process.env.APP_URL = "http://localhost:5173";
			const { readAppEnv } = await import("./api/app/env.ts");
			const { runMigrations } = await import("./api/db/migrate.ts");
			const { createDbRuntime } = await import("./api/db/index.ts");
			const { AuthService } = await import("./api/modules/auth/auth.service.ts");
			const env = readAppEnv();
			await runMigrations(env);
			const runtime = createDbRuntime(env);
			try {
				const authService = new AuthService(runtime.client, env);
				await authService.createAdmin({
					email: process.env.TEST_USER_EMAIL,
					displayName: "Admin User",
					password: "password123456",
				});
				const login = await authService.login({
					email: process.env.TEST_USER_EMAIL,
					password: "password123456",
				});
				const rotated = await authService.refresh(login.refreshToken);
				for (const token of [login.refreshToken, rotated.refreshToken]) {
					let rejected = false;
					try {
						await authService.refresh(token);
					} catch (error) {
						rejected = error instanceof Error && error.message === "Invalid refresh token.";
					}
					if (!rejected) throw new Error("refresh token family remained usable");
				}

				const concurrentLogin = await authService.login({
					email: process.env.TEST_USER_EMAIL,
					password: "password123456",
				});
				const concurrentResults = await Promise.allSettled([
					authService.refresh(concurrentLogin.refreshToken),
					authService.refresh(concurrentLogin.refreshToken),
				]);
				if (!concurrentResults.some((result) => result.status === "rejected")) {
					throw new Error("concurrent refresh reuse was not rejected");
				}
				for (const result of concurrentResults) {
					if (result.status !== "fulfilled") continue;
					let childRejected = false;
					try {
						await authService.refresh(result.value.refreshToken);
					} catch (error) {
						childRejected =
							error instanceof Error &&
							error.message === "Invalid refresh token.";
					}
					if (!childRejected) {
						throw new Error("concurrent refresh left an active child token");
					}
				}
			} finally {
				await runtime.close();
			}
		`;
		const result = spawnSync("bun", ["-e", script], {
			cwd: process.cwd(),
			encoding: "utf8",
			env: {
				...process.env,
				TEST_DATABASE_URL: testDatabaseUrl,
				TEST_USER_EMAIL: email,
			},
		});

		expect(result.status, result.stderr).toBe(0);
	});
});
