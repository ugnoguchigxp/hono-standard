import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempRoots: string[] = [];

afterEach(() => {
	for (const tempRoot of tempRoots.splice(0)) {
		fs.rmSync(tempRoot, { recursive: true, force: true });
	}
});

describe("refresh token rotation", () => {
	it("detects reuse and revokes the active token family", () => {
		const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hono-refresh-"));
		tempRoots.push(tempRoot);
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
					email: "admin@example.com",
					displayName: "Admin User",
					password: "password123456",
				});
				const login = await authService.login({
					email: "admin@example.com",
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
					email: "admin@example.com",
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
				TEST_DATABASE_URL: path.join(tempRoot, "auth.sqlite"),
			},
		});

		expect(result.status, result.stderr).toBe(0);
	});
});
