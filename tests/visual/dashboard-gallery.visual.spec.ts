import { expect, test } from "@playwright/test";
import {
	openDashboard,
	waitForDashboardVisualReady,
} from "../e2e/dashboard/dashboard-helpers";

test.setTimeout(90_000);

test("visualization gallery canonical desktop", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1100 });
	await openDashboard(page, { gallery: true });
	await waitForDashboardVisualReady(page);
	await expect(page).toHaveScreenshot("dashboard-gallery-desktop.png", {
		fullPage: true,
		animations: "disabled",
		caret: "hide",
		maxDiffPixelRatio: 0.005,
	});
});

test("visualization gallery keeps family and complex-panel baselines", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1100 });
	await openDashboard(page, { gallery: true });
	await waitForDashboardVisualReady(page);
	for (const [label, text] of [
		["gallery-cartesian-timeseries-desktop.png", "core.timeseries / smooth-line"],
		["gallery-cartesian-bars-desktop.png", "core.bar / horizontal"],
		["gallery-cartesian-compact-desktop.png", "core.timeseries / sparkline"],
		["panel-range-band.png", "core.timeseries / range-band"],
		["panel-waterfall.png", "core.bar / waterfall"],
		["panel-dual-axis.png", "core.composed / dual-axis"],
	] as const) {
		await expect(page.locator("article").filter({ hasText: text }).first()).toHaveScreenshot(label, {
			animations: "disabled",
			caret: "hide",
			maxDiffPixelRatio: 0.005,
		});
	}
});

test("KPI families keep desktop visual baselines", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1100 });
	await openDashboard(page, { gallery: true });
	await page.getByRole("tab", { name: "KPI & Status 21" }).click();
	await waitForDashboardVisualReady(page);
	for (const [label, text] of [
		["gallery-kpi-desktop.png", "core.stat / value"],
		["gallery-goal-desktop.png", "core.gauge / semi-circle"],
		["gallery-status-desktop.png", "core.traffic-light / single"],
		["panel-stat-delta-sparkline.png", "core.stat / value-delta-sparkline"],
		["panel-gauge-needle.png", "core.gauge / needle"],
		["panel-bar-gauge-retro.png", "core.bar-gauge / retro-lcd"],
		["panel-bullet-comparative.png", "core.bullet / comparative"],
		["panel-progress-steps.png", "core.progress / steps"],
		["panel-traffic-matrix.png", "core.traffic-light / matrix"],
	] as const) {
		await expect(
			page.getByRole("article").filter({ hasText: text }).first(),
		).toHaveScreenshot(label, {
			animations: "disabled",
			caret: "hide",
			maxDiffPixelRatio: 0.005,
		});
	}
});

test("composition, relationship, hierarchy, and flow families keep visual baselines", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1440, height: 1100 });
	await openDashboard(page, { gallery: true });
	await page.getByRole("tab", { name: "Composition 24" }).click();
	await waitForDashboardVisualReady(page);
	await page.mouse.move(0, 0);
	for (const [label, panelId] of [
		["panel-pie-donut.png", "pie-donut"],
		["panel-radial-progress.png", "radial-progress"],
		["panel-scatter-bubble.png", "scatter-bubble"],
		["panel-funnel-basic.png", "funnel-basic"],
	] as const) {
		await expect(
			page.locator(`article[data-panel-id="${panelId}"]`),
		).toHaveScreenshot(label, {
			animations: "disabled",
			caret: "hide",
			maxDiffPixelRatio: 0.005,
		});
	}
	await page.getByRole("tab", { name: "Hierarchy & Flow 4" }).click();
	await waitForDashboardVisualReady(page);
	for (const [label, panelId] of [
		["panel-treemap-nested.png", "treemap-nested"],
		["panel-sunburst-basic.png", "sunburst-basic"],
		["panel-sankey-basic.png", "sankey-basic"],
	] as const) {
		await expect(
			page.locator(`article[data-panel-id="${panelId}"]`),
		).toHaveScreenshot(label, {
			animations: "disabled",
			caret: "hide",
			maxDiffPixelRatio: 0.005,
		});
	}
});

test("KPI families keep the compact mobile baseline", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await openDashboard(page, { gallery: true });
	await page.getByRole("tab", { name: "KPI & Status 21" }).click();
	await waitForDashboardVisualReady(page);
	await expect(
		page.getByRole("article").filter({ hasText: "core.stat / value-delta-sparkline" }).first(),
	).toHaveScreenshot("gallery-kpi-mobile.png", {
		animations: "disabled",
		caret: "hide",
		maxDiffPixelRatio: 0.005,
	});
});
