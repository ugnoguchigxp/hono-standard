import { expect, test } from "@playwright/test";

test("public screen and health endpoint render", async ({ page }) => {
	await page.goto("/");
	await expect(
		page.getByRole("heading", { name: "Welcome to Hono Standard" }),
	).toBeVisible();
	const health = await page.request.get("/api/health");
	expect(health.ok()).toBe(true);
});
