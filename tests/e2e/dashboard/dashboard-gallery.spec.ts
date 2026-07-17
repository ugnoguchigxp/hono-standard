import { expect, test } from "@playwright/test";
import {
	expectNoPanelOverlap,
	openDashboard,
	waitForDashboardVisualReady,
} from "./dashboard-helpers";

test("gallery renders every deterministic visualization case", async ({ page }) => {
	test.setTimeout(90_000);
	await page.setViewportSize({ width: 1440, height: 1100 });
	await openDashboard(page, { gallery: true });
	await expect(
		page.getByRole("heading", { name: "Visualization Gallery" }),
	).toBeVisible();
	await waitForDashboardVisualReady(page);
	await expect(page.getByRole("link", { name: "Gallery" })).toBeVisible();
	await expect(page.locator(".dashboard-panel-error")).toHaveCount(0);
	await expect(page.getByText("Showing table fallback.")).toHaveCount(0);

	const selectCategory = async (
		label: string,
		count: number,
		exemplar: string,
	) => {
		const tab = page.getByRole("tab", { name: `${label} ${count}` });
		await tab.click();
		await expect(tab).toHaveAttribute("aria-selected", "true");
		await expect(page.getByRole("article")).toHaveCount(count);
		await expect(page.locator(`[data-panel-id="${exemplar}"]`)).toBeVisible();
		await expectNoPanelOverlap(page);
	};
	const expectPanelIds = async (ids: readonly string[]) => {
		const actual = await page
			.locator("[data-panel-id]")
			.evaluateAll((elements) =>
				elements
					.map((element) => element.getAttribute("data-panel-id"))
					.filter((id): id is string => id !== null)
					.sort(),
			);
		expect(actual).toEqual([...ids].sort());
	};

	await selectCategory("KPI & Status", 21, "stat-value");
	const kpiPanelIds = [
		"stat-sparkline",
		"stat-combined",
		"stat-list",
		"gauge-full",
		"gauge-needle",
		"bar-gauge-vertical",
		"bar-gauge-segmented",
		"bar-gauge-retro",
		"bullet-comparative",
		"progress-steps",
		"traffic-single",
		"traffic-list",
		"traffic-matrix",
	] as const;
	await expect(
		page.locator(
			kpiPanelIds
				.map((panelId) => `[data-panel-id="${panelId}"] .dashboard-kpi`)
				.join(","),
		),
	).toHaveCount(kpiPanelIds.length);
	await expect(
		page.locator(
			'[data-panel-id="progress-steps"] .dashboard-kpi-progress.preset-steps',
		),
	).toBeVisible();

	await selectCategory("Composition", 24, "pie-basic");
	await expectPanelIds([
		"pie-basic",
		"pie-donut",
		"pie-semi-donut",
		"pie-rose",
		"radar-line",
		"radar-filled",
		"radar-multi",
		"radial-ranking",
		"radial-progress",
		"scatter-basic",
		"scatter-bubble",
		"scatter-quadrant",
		"node-service-map",
		"node-dependency",
		"node-directed",
		"node-grouped",
		"node-critical-path",
		"geo-points",
		"geo-proportional",
		"geo-routes",
		"geo-regions",
		"geo-clusters",
		"funnel-basic",
		"funnel-pyramid",
	]);

	await selectCategory("Hierarchy & Flow", 4, "treemap-flat");
	await expectPanelIds([
		"treemap-flat",
		"treemap-nested",
		"sunburst-basic",
		"sankey-basic",
	]);

	await selectCategory("Observability", 15, "logs-stream");
	await expectPanelIds([
		"logs-stream",
		"logs-compact",
		"logs-severity",
		"logs-structured",
		"logs-context",
		"trace-waterfall",
		"trace-service-colored",
		"trace-critical-path",
		"trace-errors-only",
		"trace-compact",
		"flame-flame",
		"flame-icicle",
		"flame-differential",
		"flame-category",
		"flame-compact",
	]);

	await selectCategory("Distribution", 20, "hist-count");
	await expectPanelIds([
		"hist-count",
		"hist-density",
		"hist-cumulative",
		"hist-stacked",
		"hist-horizontal",
		"heatmap-matrix",
		"heatmap-time",
		"heatmap-density",
		"heatmap-diverging",
		"heatmap-annotated",
		"box-vertical",
		"box-horizontal",
		"box-grouped",
		"box-points",
		"box-range",
		"calendar-year",
		"calendar-month",
		"calendar-rolling",
		"calendar-weekday",
		"calendar-status",
	]);

	await selectCategory("Data & States", 25, "table-default");
	await expect(page.getByRole("heading", { name: "Mixed field table" })).toBeVisible();
	await expect(page.getByText("No data for this period")).toBeVisible();
	await expect(page.getByText("Partial data")).toBeVisible();
	await expect(page.getByText("Data may be out of date")).toBeVisible();
	await expect(page.getByText("Result limited")).toBeVisible();
	await expect(page.getByText("No current value", { exact: true })).toBeVisible();
	await page
		.getByRole("button", { name: "View details for Mixed field table" })
		.click();
	await expect(page.getByRole("complementary", { name: "Query inspector" })).toBeVisible();
	await page.getByRole("button", { name: "Close inspector" }).click();
	await expect(page.locator('[data-panel-id="timeline-single"]')).toBeVisible();
	await selectCategory("Cartesian", 23, "timeseries-line");
	await expect(
		page.getByRole("heading", { name: "core.timeseries / line" }).first(),
	).toBeVisible();
});

test("gallery route keeps its authentication boundary", async ({ page }) => {
	await page.goto("/dashboard/gallery");
	await expect(page.getByRole("heading", { name: "Login required" })).toBeVisible();
	await expect(page.getByRole("main").getByRole("link", { name: "Login" })).toHaveAttribute("href", /redirect=%2Fdashboard%2Fgallery/);
});
