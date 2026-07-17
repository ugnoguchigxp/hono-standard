import { expect, test } from "@playwright/test";

test("public screens render", async ({ page }) => {
	await page.goto("/");
	await expect(
		page.getByRole("heading", { name: "Welcome to Hono Standard" }),
	).toBeVisible();

	await page.goto("/login");
	await expect(page.getByRole("heading", { name: "Hono Standard" })).toBeVisible();
	await expect(page.getByLabel("Email")).toBeVisible();
	await expect(page.getByLabel("Password")).toBeVisible();

	await page.goto("/showcase?page=1&pageSize=10");
	await expect(page.getByRole("heading", { name: "Component Showcase" })).toBeVisible();
});

test("login unlocks the protected route and logout clears the session", async ({
	page,
}) => {
	await page.goto("/protected");
	await expect(page.getByRole("heading", { name: "Login required" })).toBeVisible();

	await page.getByRole("main").getByRole("link", { name: "Login" }).click();
	await expect(page).toHaveURL(/\/login\?redirect=%2Fprotected/);

	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();

	await expect(page).toHaveURL(/\/protected$/);
	await expect(page.getByRole("heading", { name: "Protected route" })).toBeVisible();
	await expect(page.getByText("Server confirmed admin@example.com as admin.")).toBeVisible();

	await page.getByRole("button", { name: "Logout" }).click();
	await expect(page.getByRole("heading", { name: "Login required" })).toBeVisible();
});

test("dashboard period filter is reflected in the URL and API request", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1100 });
	await page.goto("/login?redirect=%2Fdashboard");
	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();
	await expect(page).toHaveURL(/\/dashboard/);
	await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Request rate" })).toBeVisible();
	await expect(page.getByRole("group", { name: "Service" })).toContainText(
		"API",
	);
	await expect(
		page.getByRole("group", { name: "Region", exact: true }),
	).toContainText(
		"Global",
	);
	await expect
		.poll(() => new URL(page.url()).searchParams.get("filters"))
		.toContain("ap-northeast");
	const panels = page.getByRole("article");
	await expect(panels).toHaveCount(4);
	const panelBoxes = await panels.evaluateAll((elements) =>
		elements.map((element) => {
			const box = element.getBoundingClientRect();
			return {
				left: box.left,
				top: box.top,
				right: box.right,
				bottom: box.bottom,
				width: box.width,
			};
		}),
	);
	expect(Math.min(...panelBoxes.map((box) => box.width))).toBeGreaterThan(260);
	for (let left = 0; left < panelBoxes.length; left += 1) {
		for (let right = left + 1; right < panelBoxes.length; right += 1) {
			const first = panelBoxes[left];
			const second = panelBoxes[right];
			const overlaps =
				first.left < second.right &&
				first.right > second.left &&
				first.top < second.bottom &&
				first.bottom > second.top;
			expect(overlaps).toBe(false);
		}
	}
	const requestPromise = page.waitForRequest((request) => request.url().includes("/api/dashboards/operations/panels/request-rate/query") && request.method() === "POST");
	await page.getByLabel("Range").selectOption("15m");
	const request = await requestPromise;
	expect(request.postDataJSON().range).toEqual({ kind: "relative", value: "15m" });
	expect(request.postDataJSON().filters.region).toEqual([
		"ap-northeast",
		"eu-west",
		"global",
	]);
	await expect(page).toHaveURL(/range=15m/);
	await page.getByLabel("Range").selectOption("custom");
	const customRange = page.getByRole("group", { name: "Custom range" });
	await customRange.getByLabel("From").fill("2026-07-16T00:00");
	await customRange.getByLabel("To").fill("2026-07-16T01:00");
	const customRequestPromise = page.waitForRequest(
		(request) =>
			request
				.url()
				.includes("/api/dashboards/operations/panels/request-rate/query") &&
			request.method() === "POST",
	);
	await customRange.getByRole("button", { name: "Apply range" }).click();
	const customRequest = await customRequestPromise;
	expect(customRequest.postDataJSON().range).toMatchObject({
		kind: "absolute",
		from: expect.any(String),
		to: expect.any(String),
	});
	await expect(page).toHaveURL(/range=custom/);
	await expect(page.getByRole("heading", { name: "Summary table" })).toBeVisible();
	const requestPanel = page
		.getByRole("heading", { name: "Request rate", exact: true })
		.locator("xpath=ancestor::article");
	await requestPanel.getByRole("button", { name: "Table" }).click();
	await expect(requestPanel.getByRole("table")).toBeVisible();
	await page.getByRole("button", { name: "Edit layout" }).click();
	await expect(page.getByText("Editing layout")).toBeVisible();
	await expect(page.getByRole("button", { name: "Move Request rate down" })).toBeVisible();
	const beforeDrag = await requestPanel.boundingBox();
	expect(beforeDrag).not.toBeNull();
	if (!beforeDrag) throw new Error("Dashboard drag bounds missing");
	await page.getByRole("button", { name: "Move Request rate down" }).click();
	await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
	await page.waitForTimeout(250);
	const afterDrag = await requestPanel.boundingBox();
	expect(afterDrag?.x).not.toBe(beforeDrag.x);
	await page.getByRole("button", { name: "Save" }).click();
	await expect(page.getByRole("button", { name: "Edit layout" })).toBeVisible();
	await page.reload();
	await expect(
		page.getByRole("heading", { name: "Request rate", exact: true }),
	).toBeVisible();
	await expect(page.getByRole("group", { name: "Region" })).toContainText(
		"Global",
	);
	const persistedBox = await requestPanel.boundingBox();
	expect(persistedBox?.x).toBe(afterDrag?.x);
	await page.getByRole("button", { name: "Edit layout" }).click();
	await page.getByRole("button", { name: "Move Request rate up" }).click();
	await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
	await page.getByRole("button", { name: "Cancel" }).click();
	const cancelledBox = await requestPanel.boundingBox();
	expect(cancelledBox?.x).toBe(persistedBox?.x);
});

test("dashboard uses v2 transport and renderer-level lazy loading", async ({ page }) => {
	const requests: import("@playwright/test").Request[] = [];
	page.on("request", (request) => requests.push(request));
	await page.goto("/login?redirect=%2Fdashboard");
	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();
	await expect(page.getByRole("heading", { name: "Request rate" })).toBeVisible();
	await page.waitForTimeout(500);
	if (!requests.some((request) => request.url().includes("renderer.lazy"))) {
		throw new Error(
			`Renderer chunk was not requested. Assets: ${requests
				.map((request) => request.url())
				.filter((url) => url.includes("/assets/"))
				.join(", ")}`,
		);
	}
	const manifestRequest = requests.find(
		(request) =>
			request.url().includes("/api/dashboards/operations") &&
			request.method() === "GET",
	);
	expect(manifestRequest?.headers().accept).toContain("dashboard.v2");
	const variableRequest = requests.find((request) =>
		request.url().includes("/variables/region/options"),
	);
	expect(variableRequest?.postDataJSON().schemaVersion).toBe(2);
	const panelRequest = requests.find((request) =>
		request.url().includes("/panels/request-rate/query"),
	);
	expect(panelRequest?.postDataJSON()).toMatchObject({
		schemaVersion: 2,
		maxRows: 2000,
	});
	const requestPanel = page
		.getByRole("heading", { name: "Request rate", exact: true })
		.locator("xpath=ancestor::article");
	await requestPanel.getByRole("button", { name: "Table" }).click();
	await expect(requestPanel.getByRole("table")).toBeVisible();
});

test("dashboard falls back to a table for an unknown renderer fixture", async ({ page }) => {
	await page.route("**/api/dashboards/operations", async (route) => {
		const upstream = await route.fetch();
		const manifest = await upstream.json();
		manifest.panels = manifest.panels.map((panel: { id: string; visualization: Record<string, unknown> }) =>
			panel.id === "request-rate"
				? {
						...panel,
						visualization: { ...panel.visualization, type: "fixture.unknown" },
					}
				: panel,
		);
		await route.fulfill({ response: upstream, json: manifest });
	});
	await page.goto("/login?redirect=%2Fdashboard");
	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();
	const requestPanel = page
		.getByRole("heading", { name: "Request rate", exact: true })
		.locator("xpath=ancestor::article");
	await expect(requestPanel.getByRole("table")).toBeVisible();
});

test("dashboard collapses to one column on mobile", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/login?redirect=%2Fdashboard");
	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();
	await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
	const boxes = await page.getByRole("article").evaluateAll((elements) =>
		elements.map((element) => {
			const box = element.getBoundingClientRect();
			return { left: Math.round(box.left), width: Math.round(box.width) };
		}),
	);
	expect(new Set(boxes.map((box) => box.left)).size).toBe(1);
	expect(Math.min(...boxes.map((box) => box.width))).toBeGreaterThan(300);
});

test("dashboard Inspector displays sanitized metadata", async ({ page }) => {
	await page.goto("/login?redirect=%2Fdashboard");
	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();
	const requestPanel = page
		.getByRole("heading", { name: "Request rate", exact: true })
		.locator("xpath=ancestor::article");
	await requestPanel.getByRole("button", { name: "Inspect Request rate" }).click();
	const inspector = page.getByRole("complementary", { name: "Query inspector" });
	await expect(inspector).toContainText("Request rate inspector");
	await expect(inspector).toContainText("Duration");
	await expect(inspector).not.toContainText("api");
	await inspector.getByRole("button", { name: "Close inspector" }).click();
	await expect(inspector).toBeHidden();
});
