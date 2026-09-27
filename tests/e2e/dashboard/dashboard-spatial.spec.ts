import { expect, test } from "@playwright/test";
import { openDashboard } from "./dashboard-helpers";

test("direct Spatial URL avoids Grid queries and preserves search on return", async ({ page }) => {
	await openDashboard(page);
	const panelRequests: string[] = [];
	page.on("request", (request) => {
		if (/\/api\/dashboards\/[^/]+\/panels/.test(request.url())) panelRequests.push(request.url());
	});
	await page.goto("/dashboard?surface=spatial&range=1h");
	await expect(page.locator('[data-spatial-ready="true"]')).toBeVisible();
	await expect(page.getByRole("heading", { name: "System map" })).toBeVisible();
	await expect(page.locator(".spatial-canvas canvas")).toBeVisible();
	const canvas = page.locator(".spatial-canvas canvas");
	const size = await canvas.boundingBox();
	if (!size) throw new Error("Spatial canvas has no layout box");
	await canvas.click({ position: { x: size.width / 2, y: size.height / 2 } });
	await expect(page.getByRole("complementary", { name: "Selected signal details" })).toBeVisible();
	await page.getByRole("heading", { name: "Entities" }).locator("..").getByRole("button", { name: /Agent Core/ }).click();
	await expect(page.getByRole("complementary", { name: "Selected signal details" })).toContainText("Agent Core");
	await expect(page.getByRole("complementary", { name: "Selected object" })).toContainText("ServiceSAAA Agent Core");
	await page.getByRole("heading", { name: "Entities" }).locator("..").getByRole("button", { name: /Memory/ }).click();
	await expect(page.getByRole("complementary", { name: "Selected object" })).toContainText("Reads and maintains personal state");
	await page.getByRole("heading", { name: "Entities" }).locator("..").getByRole("button", { name: /LLM Response/ }).click();
	await expect(page.getByRole("complementary", { name: "Selected object" })).toContainText("harness.llm");
	await page.getByRole("heading", { name: "Entities" }).locator("..").getByRole("button", { name: /World Model/ }).click();
	await expect(page.getByRole("complementary", { name: "Selected object" })).toContainText("world.status");
	await page.getByRole("button", { name: /Review queue queue/ }).click();
	await expect(page.getByRole("complementary", { name: "Selected object" })).toContainText("ContextStill");
	await expect(page.getByRole("complementary", { name: "Selected object" })).toContainText("Independent queue");
	await expect(page.getByRole("status").filter({ hasText: "Connection: live" })).toBeVisible();
	expect(panelRequests).toHaveLength(0);
	await page.getByRole("button", { name: "Grid" }).click();
	await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
	await expect(page).toHaveURL(/range=1h/);
	await expect(page).not.toHaveURL(/surface=spatial/);
	await page.getByRole("button", { name: "Edit layout" }).click();
	await expect(page.getByRole("button", { name: "Spatial" })).toBeDisabled();
	await page.getByRole("button", { name: "Cancel" }).click();
	await expect(page.getByRole("button", { name: "Spatial" })).toBeEnabled();
});

test("Spatial keeps HTML details when WebGL is unavailable", async ({ page }) => {
	await openDashboard(page);
	await page.addInitScript(() => {
		const original = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type, ...args) {
			if (type === "webgl2") return null;
			return original.call(this, type, ...args);
		} as typeof original;
	});
	await page.goto("/dashboard?surface=spatial");
	await expect(page.getByText("WebGL is unavailable on this device.")).toBeVisible();
	await page.getByRole("heading", { name: "Entities" }).locator("..").getByRole("button", { name: /Agent Core/ }).click();
	await expect(page.getByRole("complementary", { name: "Selected signal details" })).toContainText("Agent Core");
});

test("Spatial canvas zooms with the wheel and pans with right drag", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openDashboard(page);
	await page.goto("/dashboard?surface=spatial");
	const canvas = page.locator(".spatial-canvas canvas");
	await expect(canvas).toBeVisible();
	const box = await canvas.boundingBox();
	if (!box) throw new Error("Spatial canvas has no layout box");
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;
	await page.mouse.move(x, y);
	const initialZoom = Number(await canvas.getAttribute("data-camera-zoom"));
	expect(initialZoom).toBeGreaterThan(0);
	await page.mouse.wheel(0, -450);
	await expect.poll(async () => Number(await canvas.getAttribute("data-camera-zoom"))).toBeGreaterThan(initialZoom);
	const initialPan = await canvas.getAttribute("data-camera-pan");
	await page.mouse.down({ button: "right" });
	await page.mouse.move(x + 90, y + 55, { steps: 5 });
	await page.mouse.up({ button: "right" });
	await expect.poll(async () => canvas.getAttribute("data-camera-pan")).not.toBe(initialPan);
	await expect(canvas).toHaveCSS("cursor", "auto");
	const beforeButtonZoom = Number(await canvas.getAttribute("data-camera-zoom"));
	await page.getByRole("button", { name: "Zoom in" }).click();
	await expect.poll(async () => Number(await canvas.getAttribute("data-camera-zoom"))).toBeGreaterThan(beforeButtonZoom);
	await page.getByRole("button", { name: "Reset view" }).click();
	await expect.poll(async () => Number(await canvas.getAttribute("data-camera-zoom"))).toBeCloseTo(initialZoom, 2);
	await expect(canvas).toHaveAttribute("data-camera-pan", "0.000,0.000,0.000");
});

test("Spatial recovers its scene after graphics context loss", async ({ page }) => {
	await openDashboard(page);
	await page.goto("/dashboard?surface=spatial");
	const canvas = page.locator(".spatial-canvas canvas");
	await expect(canvas).toBeVisible();
	await canvas.dispatchEvent("webglcontextlost", { bubbles: false, cancelable: true });
	await expect(page.getByText("The graphics context was lost.")).toBeVisible();
	await page.getByRole("heading", { name: "Entities" }).locator("..").getByRole("button", { name: /Agent Core/ }).click();
	await expect(page.getByRole("complementary", { name: "Selected signal details" })).toContainText("Agent Core");
	await page.getByRole("button", { name: "Retry scene" }).click();
	await expect(page.locator(".spatial-canvas canvas")).toBeVisible();
});

test("active Queue animates while live and stops for reduced motion", async ({ page }) => {
	await openDashboard(page);
	await page.goto("/dashboard?surface=spatial");
	await expect(page.locator(".spatial-canvas canvas")).toBeVisible();
	await expect(page.getByRole("status").filter({ hasText: "Connection: live" })).toBeVisible();
	const sampleDrawCalls = () => page.evaluate(async () => {
		const prototype = WebGL2RenderingContext.prototype;
		const originalElements = prototype.drawElements;
		const originalArrays = prototype.drawArrays;
		let calls = 0;
		prototype.drawElements = function (this: WebGL2RenderingContext, ...args) { calls += 1; return originalElements.apply(this, args); } as typeof originalElements;
		prototype.drawArrays = function (this: WebGL2RenderingContext, ...args) { calls += 1; return originalArrays.apply(this, args); } as typeof originalArrays;
		try {
			const windows: number[] = [];
			for (let index = 0; index < 4; index += 1) {
				const before = calls;
				await new Promise((resolve) => setTimeout(resolve, 80));
				windows.push(calls - before);
			}
			return windows;
		} finally {
			prototype.drawElements = originalElements;
			prototype.drawArrays = originalArrays;
		}
	});
	expect((await sampleDrawCalls()).filter((count) => count > 0).length).toBeGreaterThanOrEqual(3);
	await page.emulateMedia({ reducedMotion: "reduce" });
	expect(Math.min(...await sampleDrawCalls())).toBe(0);
});

test("Grid and Spatial share the dashboard route and show live mock changes", async ({ page }) => {
	await openDashboard(page);
	await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
	await page.getByRole("button", { name: "Spatial" }).click();
	await expect(page).toHaveURL(/surface=spatial/);
	await expect(page.locator('[data-spatial-ready="true"]')).toBeVisible();
	await expect(page.getByRole("status").filter({ hasText: "Connection: live" })).toBeVisible();
	await expect(page.getByText("Scenario:")).toContainText("normal");
	await expect(page.locator(".dashboard-grid-shell")).toHaveCount(0);
	await expect(page.locator(".spatial-canvas canvas")).toBeVisible();
	const normalScene = await page.locator(".spatial-canvas canvas").screenshot();

	const switchScenario = (scenario: string) => page.evaluate(async (name) => {
		const response = await fetch("/api/observatory/mock/scenario", {
			method: "POST", credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ scenario: name }),
		});
		return response.status;
	}, scenario);
	try {
		expect(await switchScenario("runtime-degraded")).toBe(200);
		await expect(page.getByText("Scenario:")).toContainText("runtime-degraded");
		await expect(page.getByRole("heading", { name: "Boundaries" }).locator("..")).toContainText("degraded");
		expect((await page.locator(".spatial-canvas canvas").screenshot()).equals(normalScene)).toBe(false);
		expect(await switchScenario("total-signal-loss")).toBe(200);
		await expect(page.getByRole("heading", { name: "Entities" }).locator("..")).toContainText("disconnected", { timeout: 10_000 });
		expect(await switchScenario("recovery")).toBe(200);
		await expect(page.getByRole("heading", { name: "Entities" }).locator("..")).not.toContainText("disconnected");
	} finally {
		await switchScenario("normal");
	}

	await page.getByRole("button", { name: "Grid" }).click();
	await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
	await expect(page.getByRole("article")).toHaveCount(8);
	await page.goBack();
	await expect(page.locator('[data-spatial-ready="true"]')).toBeVisible();
});
