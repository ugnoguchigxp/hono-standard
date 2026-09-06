import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createAuthlessTemplate } from "./create-authless";

const tempRoots: string[] = [];

afterEach(() => {
	for (const tempRoot of tempRoots.splice(0)) {
		fs.rmSync(tempRoot, { recursive: true, force: true });
	}
});

describe("createAuthlessTemplate", () => {
	it("creates a non-destructive authless copy with its own contract", () => {
		const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hono-authless-"));
		tempRoots.push(tempRoot);
		const target = path.join(tempRoot, "app");
		createAuthlessTemplate(target, {
			repositoryRoot: process.cwd(),
			updateLockfile: false,
		});

		expect(fs.existsSync(path.join(target, "api/modules/auth"))).toBe(false);
		expect(
			fs.existsSync(path.join(target, "web/src/views/showcase-view.tsx")),
		).toBe(false);
		expect(
			fs.readFileSync(path.join(target, "api/app/hono.ts"), "utf8"),
		).not.toContain("createAuthRoute");
		expect(
			fs.existsSync(path.join(target, "web/src/session-cache.test.ts")),
		).toBe(false);
		expect(
			fs.existsSync(path.join(target, "web/src/session-lock.test.ts")),
		).toBe(false);
		expect(
			fs.readFileSync(path.join(target, "api/worker.ts"), "utf8"),
		).not.toContain("AuthService");
		expect(
			fs.readFileSync(path.join(target, "wrangler.toml"), "utf8"),
		).not.toMatch(/JWT|AUTH_COOKIE/);
		const manifest = JSON.parse(
			fs.readFileSync(path.join(target, "package.json"), "utf8"),
		) as {
			scripts: Record<string, string>;
			dependencies: Record<string, string>;
		};
		expect(manifest.scripts["auth:create-admin"]).toBeUndefined();
		expect(manifest.dependencies.jose).toBeUndefined();
		expect(
			fs.existsSync(path.join(target, "api/cli/auth-create-admin.test.ts")),
		).toBe(false);
		expect(
			fs.readFileSync(path.join(target, "CONTRIBUTING.md"), "utf8"),
		).not.toContain("template-variant-management");
		expect(
			fs.readFileSync(path.join(target, "CHANGELOG.md"), "utf8"),
		).not.toContain("refresh token");
		expect(
			fs.readFileSync(path.join(target, "scripts/bootstrap.ts"), "utf8"),
		).not.toMatch(/JWT|auth/i);
	});

	it("refuses to overwrite an existing target", () => {
		const target = fs.mkdtempSync(
			path.join(os.tmpdir(), "hono-authless-existing-"),
		);
		tempRoots.push(target);
		expect(() =>
			createAuthlessTemplate(target, { updateLockfile: false }),
		).toThrow(/already exists/);
	});

	it("removes a partial target when generation fails", () => {
		const tempRoot = fs.mkdtempSync(
			path.join(os.tmpdir(), "hono-authless-failure-"),
		);
		tempRoots.push(tempRoot);
		const repositoryRoot = path.join(tempRoot, "repository");
		const target = path.join(tempRoot, "app");
		fs.mkdirSync(path.join(repositoryRoot, "templates", "authless"), {
			recursive: true,
		});
		fs.writeFileSync(path.join(repositoryRoot, "package.json"), "{");
		expect(
			spawnSync("git", ["init", "--quiet"], { cwd: repositoryRoot }).status,
		).toBe(0);
		expect(
			spawnSync("git", ["add", "package.json"], { cwd: repositoryRoot }).status,
		).toBe(0);

		expect(() =>
			createAuthlessTemplate(target, {
				repositoryRoot,
				updateLockfile: false,
			}),
		).toThrow();
		expect(fs.existsSync(target)).toBe(false);
	});
});
