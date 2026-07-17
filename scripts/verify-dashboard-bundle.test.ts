import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard bundle budget", () => {
	it("uses positive raw and gzip budgets", async () => {
		const budget = JSON.parse(await readFile(path.resolve(process.cwd(), "scripts/dashboard-bundle-budget.json"), "utf8")) as { initial: { rawBytes: number; gzipBytes: number }; dashboardShell: { rawBytes: number; gzipBytes: number }; kpiRenderers: Record<string, { rawBytes: number; gzipBytes: number }> };
		for (const value of [budget.initial, budget.dashboardShell, ...Object.values(budget.kpiRenderers)]) {
			expect(value.rawBytes).toBeGreaterThan(0);
			expect(value.gzipBytes).toBeGreaterThan(0);
			expect(value.gzipBytes).toBeLessThan(value.rawBytes);
		}
		expect(Object.keys(budget.kpiRenderers)).toEqual([
			"core-stat",
			"core-gauge",
			"core-bar-gauge",
			"core-bullet",
			"core-progress",
			"core-traffic-light",
		]);
	});
});
