import { expect, test } from "@playwright/test";

test("RAG login unlocks the authenticated workspace", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "Hono Standard" })).toBeVisible();
	await expect(page.getByLabel("Email")).toBeVisible();
	await expect(page.getByLabel("Password")).toBeVisible();

	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();

	await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible();
	await expect(page.getByText("Admin User (admin)")).toBeVisible();

	await page.getByRole("link", { name: "Settings" }).click();
	await expect(page).toHaveURL(/\/settings$/);
	await expect(page.getByRole("heading", { name: "API Health" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "System Context" })).toBeVisible();
	await page.getByLabel("Instruction language").selectOption("en-US");
	await page.getByLabel("Agentic Search Prompt").fill("Prefer strict citations.");
	const saveResponse = page.waitForResponse(
		(response) =>
			response.request().method() === "PUT" &&
			new URL(response.url()).pathname === "/api/settings/system-context",
	);
	await page.getByRole("button", { name: "Save" }).click();
	expect((await saveResponse).ok()).toBe(true);
	await page.reload();
	await expect(page.getByLabel("Instruction language")).toHaveValue("en-US");
	await expect(page.getByLabel("Agentic Search Prompt")).toHaveValue(
		"Prefer strict citations.",
	);

	await page.getByRole("link", { name: "Knowledge" }).click();
	await expect(page).toHaveURL(/\/knowledge$/);
	await expect(page.getByRole("heading", { name: "Explorer" })).toBeVisible();

	await page.getByRole("button", { name: "Logout" }).click();
	await expect(page.getByRole("heading", { name: "Hono Standard" })).toBeVisible();
});
