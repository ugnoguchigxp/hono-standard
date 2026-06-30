import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const updateScreenshots = process.env.UPDATE_TEMPLATE_SCREENSHOTS === "1";

async function captureTemplateScreenshot(
	page: Page,
	name: string,
) {
	if (!updateScreenshots) return;
	mkdirSync("docs/assets", { recursive: true });
	await page.screenshot({
		path: `docs/assets/${name}.png`,
		fullPage: true,
	});
}

test("public screens render", async ({ page }) => {
	await page.goto("/");
	await expect(
		page.getByRole("heading", { name: "Welcome to Hono Standard" }),
	).toBeVisible();
	await captureTemplateScreenshot(page, "home");

	await page.goto("/login");
	await expect(page.getByRole("heading", { name: "Hono Standard" })).toBeVisible();
	await expect(page.getByLabel("Email")).toBeVisible();
	await expect(page.getByLabel("Password")).toBeVisible();
	await captureTemplateScreenshot(page, "login");

	await page.goto("/showcase?page=1&pageSize=10");
	await expect(page.getByRole("heading", { name: "Component Showcase" })).toBeVisible();
	await captureTemplateScreenshot(page, "showcase");
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
	await captureTemplateScreenshot(page, "protected");

	await page.getByRole("button", { name: "Logout" }).click();
	await expect(page.getByRole("heading", { name: "Login required" })).toBeVisible();
});
