import { expect, test } from "@playwright/test";
import { openDashboard, waitForDashboardReady } from "../e2e/dashboard/dashboard-helpers";

test("dashboard gallery stays within deterministic browser budgets", async ({ page }) => {
	await openDashboard(page, { gallery: true });
	await waitForDashboardReady(page);
	const metrics = await page.evaluate(() => {
		const entries = performance.getEntriesByType("longtask");
		const kpiSvgNodes = [...document.querySelectorAll(".dashboard-kpi")].map(
			(element) => element.querySelectorAll("svg, path, polyline, line, circle").length,
		);
		return {
			longTasks: entries.map((entry) => entry.duration),
			panels: document.querySelectorAll("article").length,
			maxKpiSvgNodes: Math.max(0, ...kpiSvgNodes),
		};
	});
	expect(metrics.panels).toBe(23);
	expect(metrics.maxKpiSvgNodes).toBeLessThan(500);
	expect(Math.max(0, ...metrics.longTasks)).toBeLessThan(100);
});
