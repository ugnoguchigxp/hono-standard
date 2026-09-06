import { expect, test } from "@playwright/test";

test("tabs use a single Tab stop, arrow navigation, and labelled panels", async ({
	page,
}) => {
	await page.goto("/showcase");
	const account = page.getByRole("tab", { name: "Account", exact: true });
	const password = page.getByRole("tab", { name: "Password", exact: true });
	const settings = page.getByRole("tab", { name: "Settings", exact: true });
	await account.focus();
	for (const [key, selected] of [
		["ArrowRight", password],
		["End", settings],
		["ArrowRight", account],
		["ArrowLeft", settings],
		["Home", account],
	] as const) {
		await page.keyboard.press(key);
		await expect(selected).toBeFocused();
		await expect(selected).toHaveAttribute("aria-selected", "true");
		await expect(
			page.getByRole("tablist").locator('[tabindex="0"]'),
		).toHaveCount(1);
		const panelId = await selected.getAttribute("aria-controls");
		await expect(page.locator(`#${panelId}`)).toBeVisible();
	}
	await page.keyboard.press("Tab");
	await expect(
		page.getByRole("tabpanel", { name: "Account", exact: true }),
	).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(page.getByLabel("Account name")).toBeFocused();
});

test("drawer contains focus, closes with Escape, and restores the trigger", async ({
	page,
}) => {
	await page.goto("/showcase");
	const trigger = page.getByRole("button", { name: "Open Panel", exact: true });
	await trigger.click();
	const drawer = page.getByRole("dialog", { name: "Settings panel" });
	const close = drawer.getByRole("button", { name: "Close panel" });
	await expect(drawer).toBeVisible();
	await expect(close).toBeFocused();
	await page.keyboard.press("Shift+Tab");
	await expect(drawer.getByLabel("Compact mode")).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(close).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(drawer.getByLabel("Audit log")).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(drawer).not.toBeVisible();
	await expect(trigger).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(drawer).toBeVisible();
	await close.click();
	await expect(trigger).toBeFocused();
});

test("showcase reflows at narrow widths and keeps table scrolling inside its panel", async ({
	page,
}) => {
	for (const width of [320, 390, 768]) {
		await page.setViewportSize({ width, height: 844 });
		await page.goto("/showcase?page=1&pageSize=10");
		await expect(
			page.getByRole("heading", { name: "Component Showcase" }),
		).toBeVisible();
		for (const size of ["Medium", "Large"]) {
			await page.getByRole("button", { name: size, exact: true }).click();
			await expect
				.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
				.toBeLessThanOrEqual(width);
			const table = page.locator(".table-panel");
			await table.scrollIntoViewIfNeeded();
			const bounds = await table.boundingBox();
			expect(bounds).not.toBeNull();
			expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
				width,
			);
		}
	}
});

test("public screens render", async ({ page }) => {
	await page.goto("/");
	await expect(
		page.getByRole("heading", { name: "Welcome to Hono Standard" }),
	).toBeVisible();

	await page.goto("/login");
	await expect(
		page.getByRole("heading", { name: "Hono Standard" }),
	).toBeVisible();
	await expect(page.getByLabel("Email")).toBeVisible();
	await expect(page.getByLabel("Password")).toBeVisible();

	await page.goto("/showcase?page=1&pageSize=10");
	await expect(
		page.getByRole("heading", { name: "Component Showcase" }),
	).toBeVisible();
});

test("login unlocks the protected route and logout clears the session", async ({
	page,
}) => {
	await page.goto("/protected");
	await expect(
		page.getByRole("heading", { name: "Login required" }),
	).toBeVisible();

	await page.getByRole("main").getByRole("link", { name: "Login" }).click();
	await expect(page).toHaveURL(/\/login\?redirect=%2Fprotected/);

	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();

	await expect(page).toHaveURL(/\/protected$/);
	await expect(
		page.getByRole("heading", { name: "Protected route" }),
	).toBeVisible();
	await expect(
		page.getByText("Server confirmed admin@example.com as admin."),
	).toBeVisible();
	// Simulate expiry while retaining the valid refresh cookie.
	await page.context().clearCookies({ name: "access_token" });
	await page.reload();
	await expect(
		page.getByText("Server confirmed admin@example.com as admin."),
	).toBeVisible();
	const adminResponse = await page.request.get("/api/protected/admin");
	expect(adminResponse.status()).toBe(200);
	expect(await adminResponse.json()).toEqual({
		admin: { email: "admin@example.com" },
	});

	await page.getByRole("button", { name: "Logout" }).click();
	await expect(
		page.getByRole("heading", { name: "Login required" }),
	).toBeVisible();
});

test("modal supports keyboard navigation, Escape, and focus restoration", async ({
	page,
}) => {
	await page.goto("/showcase");
	const trigger = page.getByRole("button", {
		name: "Open Dialog",
		exact: true,
	});
	await trigger.click();
	const dialog = page.getByRole("dialog", { name: "Confirm deployment" });
	await expect(dialog).toBeVisible();
	const close = dialog.getByRole("button", { name: "Close dialog" });
	await expect(close).toBeFocused();
	await page.keyboard.press("Shift+Tab");
	await expect(
		dialog.getByRole("button", { name: "Deploy", exact: true }),
	).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(close).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(dialog).not.toBeVisible();
	await expect(trigger).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(dialog).toBeVisible();
	await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(trigger).toBeFocused();
});

test("failed logout preserves the session, displays an error, and can be retried", async ({
	page,
}) => {
	await page.goto("/login?redirect=%2Fprotected");
	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();
	await expect(
		page.getByText("Server confirmed admin@example.com as admin."),
	).toBeVisible();
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.route("**/api/auth/logout", (route) =>
		route.fulfill({
			status: 503,
			contentType: "application/json",
			body: JSON.stringify({ message: "Unavailable" }),
		}),
	);
	await page.getByRole("button", { name: "Logout" }).click();
	await expect(
		page.getByText("Logout failed. Please try again."),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Protected route", exact: true }),
	).toBeVisible();
	expect(errors).toEqual([]);
	await page.unroute("**/api/auth/logout");
	await page.getByRole("button", { name: "Logout" }).click();
	await expect(
		page.getByRole("heading", { name: "Login required" }),
	).toBeVisible();
	await page.reload();
	await expect(
		page.getByRole("heading", { name: "Login required" }),
	).toBeVisible();
});

test("account switching never displays the previous profile while the new request is pending", async ({
	page,
}) => {
	await page.goto("/login?redirect=%2Fprotected");
	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();
	await expect(
		page.getByText("Server confirmed admin@example.com as admin."),
	).toBeVisible();
	await page.getByRole("button", { name: "Logout" }).click();
	await expect(
		page.getByRole("heading", { name: "Login required" }),
	).toBeVisible();
	await page
		.getByRole("main")
		.getByRole("link", { name: "Login", exact: true })
		.click();
	let release: () => void = () => {};
	const pending = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/api/protected/profile", async (route) => {
		await pending;
		await route.continue();
	});
	try {
		await page.getByLabel("Email").fill("second@example.com");
		await page.getByLabel("Password").fill("password123456");
		await page.getByRole("button", { name: /ログイン/ }).click();
		await expect(
			page.getByRole("main").getByText("Second User (admin)"),
		).toBeVisible();
		await expect(page.getByText("Server profile is loading.")).toBeVisible();
		await expect(
			page.getByText(/Server confirmed admin@example.com/),
		).toHaveCount(0);
	} finally {
		release();
	}
	await expect(
		page.getByText("Server confirmed second@example.com as admin."),
	).toBeVisible();
});

test("two tabs restore one shared session without reusing a refresh token", async ({
	page,
	context,
}) => {
	await page.goto("/login?redirect=%2Fprotected");
	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();
	await expect(
		page.getByText("Server confirmed admin@example.com as admin."),
	).toBeVisible();
	const second = await context.newPage();
	await context.clearCookies({ name: "access_token" });
	let initialRequests = 0;
	let release: () => void = () => {};
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	// Deliver both initial 401s together; refresh itself must remain serialized.
	await context.route("**/api/auth/me", async (route) => {
		if (++initialRequests > 2) {
			await route.continue();
			return;
		}
		const response = await route.fetch();
		expect(response.status()).toBe(401);
		if (initialRequests === 2) release();
		await gate;
		await route.fulfill({ response });
	});
	let rotations = 0;
	context.on("request", (request) => {
		if (request.url().endsWith("/api/auth/refresh")) rotations++;
	});
	await Promise.all([page.reload(), second.goto("/protected")]);
	for (const tab of [page, second]) {
		await expect(
			tab.getByText("Server confirmed admin@example.com as admin."),
		).toBeVisible();
	}
	expect(rotations).toBe(1);
	await context.unroute("**/api/auth/me");
	await context.clearCookies({ name: "access_token" });
	await page.reload();
	await expect(
		page.getByText("Server confirmed admin@example.com as admin."),
	).toBeVisible();
	expect(rotations).toBe(2);
});
