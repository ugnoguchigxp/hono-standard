import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { openDashboard, waitForDashboardReady } from "../e2e/dashboard/dashboard-helpers";

test("dashboard gallery has no serious or critical axe violations", async ({ page }) => {
	await openDashboard(page, { gallery: true });
	await waitForDashboardReady(page);
	const results = await new AxeBuilder({ page }).analyze();
	const blocking = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""));
	expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});

test("dashboard gallery supports reduced motion and keyboard focus", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openDashboard(page, { gallery: true });
	await waitForDashboardReady(page);
	await page.keyboard.press("Tab");
	await expect(page.locator(":focus")).toBeVisible();
	expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
});

test("KPI status remains readable in forced colors and at 200 percent zoom", async ({ page }) => {
	await page.emulateMedia({ forcedColors: "active" });
	await openDashboard(page, { gallery: true });
	await page.getByRole("tab", { name: "KPI & Status 21" }).click();
	await waitForDashboardReady(page);
	await expect(page.locator(".dashboard-kpi").first()).toBeVisible();
	await expect(page.locator(".dashboard-kpi-state, .dashboard-kpi-signal").first()).toBeVisible();

	const svgTabStops = await page.locator(".dashboard-kpi svg[tabindex]").count();
	expect(svgTabStops).toBe(0);

	const tableToggle = page.getByRole("button", { name: "Table" }).first();
	await tableToggle.focus();
	await expect(tableToggle).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(page.getByRole("article").first().getByRole("table")).toBeVisible();

	await page.evaluate(() => {
		document.documentElement.style.zoom = "2";
	});
	const clippedKpis = await page.locator(".dashboard-kpi").evaluateAll((elements) =>
		elements.filter((element) => element.scrollWidth > element.clientWidth + 4).length,
	);
	expect(clippedKpis).toBe(0);
});
