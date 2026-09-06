import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

it("builds identical production assets regardless of the runtime NODE_ENV", () => {
	const root = mkdtempSync(path.join(tmpdir(), "hono-build-contract-"));
	try {
		const builds = ["development", "production"].map((nodeEnv) => {
			const out = path.join(root, nodeEnv);
			const result = spawnSync("bun", ["run", "build:web", "--outDir", out], {
				env: { ...process.env, NODE_ENV: nodeEnv },
				encoding: "utf8",
			});
			expect(result.status, result.stderr).toBe(0);
			const assets = path.join(out, "assets");
			return Object.fromEntries(
				readdirSync(assets)
					.sort()
					.map((name) => [name, readFileSync(path.join(assets, name), "utf8")]),
			);
		});
		expect(
			Object.keys(builds[0]).some(
				(file) => file.startsWith("react-runtime-") && file.endsWith(".js"),
			),
		).toBe(true);
		expect(builds[0]).toEqual(builds[1]);
		expect(Object.values(builds[0]).join("\n")).not.toContain(
			"react.dev/link/invalid-hook-call",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}, 30_000);
