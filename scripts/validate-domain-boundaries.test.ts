import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateDomainBoundaries } from "./validate-domain-boundaries";

const tempRoots: string[] = [];

const makeProject = (files: Record<string, string>): string => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "domain-boundaries-"));
	tempRoots.push(root);
	for (const [relativePath, source] of Object.entries(files)) {
		const filePath = path.join(root, relativePath);
		fs.mkdirSync(path.dirname(filePath), { recursive: true });
		fs.writeFileSync(filePath, source);
	}
	for (const requiredRoot of ["shared", "web/src"]) {
		fs.mkdirSync(path.join(root, requiredRoot), { recursive: true });
	}
	return root;
};

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

describe("game domain boundary validation", () => {
	it("allows each runtime to use its own domain and shared platform", () => {
		const root = makeProject({
			"shared/game/index.ts": 'export { shared } from "../game-platform";',
			"shared/action3d/index.ts":
				'import { shared } from "@shared/game-platform"; export { shared };',
			"shared/game-platform/index.ts": "export const shared = true;",
			"web/src/game/index.ts": 'export * from "@shared/game";',
			"web/src/action3d/index.ts": 'export * from "@shared/action3d";',
			"web/src/game-platform/index.ts":
				'export * from "@shared/game-platform";',
		});

		expect(validateDomainBoundaries(root)).toEqual([]);
	});

	it("reports static and dynamic imports that cross game domains", () => {
		const root = makeProject({
			"shared/game/index.ts": 'export * from "@shared/action3d";',
			"shared/action3d/index.ts": 'import "../game/model";',
			"web/src/game/index.ts": 'void import("../action3d/runtime");',
			"web/src/action3d/index.ts": 'import "@/game/GameScreen";',
		});

		const issues = validateDomainBoundaries(root);
		expect(issues).toHaveLength(4);
		expect(issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
				sourcePath: "shared/game/index.ts",
				rule: "rpg-domain must not import action3d-domain",
				}),
				expect.objectContaining({
				sourcePath: "shared/action3d/index.ts",
				rule: "action3d-domain must not import rpg-domain",
				}),
				expect.objectContaining({
				sourcePath: "web/src/game/index.ts",
				rule: "rpg-web must not import action3d-web",
				}),
				expect.objectContaining({
				sourcePath: "web/src/action3d/index.ts",
				rule: "action3d-web must not import rpg-web",
				}),
			]),
		);
	});

	it("prevents shared platform code from depending on either game", () => {
		const root = makeProject({
			"shared/game-platform/index.ts": 'export * from "../game";',
			"web/src/game-platform/index.ts":
				'import "../action3d/Action3dView";',
		});

		expect(validateDomainBoundaries(root)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
				rule: "shared-platform must not import rpg-domain",
				}),
				expect.objectContaining({
				rule: "web-platform must not import action3d-web",
				}),
			]),
		);
	});
});
