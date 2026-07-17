import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { dashboardReleaseSteps } from "./verify-dashboard-release";

describe("dashboard release orchestrator", () => {
	it("runs every release gate in the documented order", () => {
		expect(dashboardReleaseSteps).toEqual([
			["verify", ["run", "verify"]],
			["dashboard-contract", ["run", "verify:dashboard-contract"]],
			[
				"dashboard-adapter-sqlite",
				["run", "verify:dashboard-adapter-sqlite"],
			],
			["dashboard-coverage", ["run", "verify:dashboard-coverage"]],
			[
				"dashboard-frontend-coverage",
				["run", "verify:dashboard-frontend-coverage"],
			],
			["dashboard-gallery", ["run", "verify:dashboard-gallery"]],
			["dashboard-bundle", ["run", "verify:dashboard-bundle"]],
			["dashboard-e2e", ["run", "verify:dashboard-e2e"]],
			["dashboard-visual", ["run", "verify:dashboard-visual"]],
			["dashboard-a11y", ["run", "verify:dashboard-a11y"]],
			["dashboard-performance", ["run", "verify:dashboard-performance"]],
			["dashboard-security", ["run", "verify:dashboard-security"]],
			["dashboard-doc-links", ["run", "verify:dashboard-doc-links"]],
			["diff-check", ["exec", "git diff --check"]],
		]);
	});

	it("keeps the orchestrator fail-fast and streams child output", async () => {
		const source = await readFile("scripts/verify-dashboard-release.ts", "utf8");
		expect(source).toContain('stdio: "inherit"');
		expect(source).toContain("if (code !== 0)");
		expect(source).toContain("return code;");
		expect(source).toContain("process.exit(await runDashboardRelease())");
	});
});
