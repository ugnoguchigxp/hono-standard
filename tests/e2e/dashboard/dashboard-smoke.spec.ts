import { expect, test } from "@playwright/test";
import {
	expectNoPanelOverlap,
	openDashboard,
	waitForDashboardVisualReady,
} from "./dashboard-helpers";

test("operations dashboard stays functional in the dashboard suite", async ({ page }) => {
	await openDashboard(page);
	await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Request rate" })).toBeVisible();
	await waitForDashboardVisualReady(page);
	await expect(page.getByRole("article")).toHaveCount(8);
	await expect(page.locator(".dashboard-panel-error")).toHaveCount(0);
	await expect(page.getByText("Showing table fallback.")).toHaveCount(0);
	await expect(page.getByRole("link", { name: "Visualization gallery" })).toBeVisible();
	await expect(page.locator('[data-panel-id="error-ratio"]')).toContainText("2.4%");
	await expect(page.locator('[data-panel-id="availability"] .dashboard-kpi-gauge')).toBeVisible();
	await expect(
		page.locator('[data-panel-id="capacity"] .dashboard-kpi-segments').first(),
	).toBeVisible();
	await expect(page.locator('[data-panel-id="latency-objectives"] .dashboard-kpi-bullet')).toBeVisible();
	await expect(
		page.locator(
			'[data-panel-id="deployment-progress"] .dashboard-kpi-progress.preset-steps',
		),
	).toBeVisible();
	await expect(
		page.locator(
			'[data-panel-id="service-health"] .dashboard-kpi-traffic.preset-matrix',
		),
	).toBeVisible();
	await expectNoPanelOverlap(page);
});
