import { expect, test } from "@playwright/test";

test("authenticated user can create and step a brain experiment", async ({
	page,
}, testInfo) => {
	const email =
		testInfo.project.name === "mobile-chromium"
			? "second@example.com"
			: "admin@example.com";
	await page.goto("/login");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: "ログイン" }).click();
	await expect(page.getByText(/User \(admin\)/)).toBeVisible();
	await page.getByRole("link", { name: "Brain sandbox" }).click();
	await expect(
		page.getByRole("heading", { name: "Organic Brain Sandbox" }),
	).toBeVisible();
	const [created] = await Promise.all([
		page.waitForResponse(
			(response) =>
				response.url().endsWith("/api/experiments") &&
				response.request().method() === "POST",
		),
		page.getByRole("button", { name: "Create experiment" }).click(),
	]);
	expect(created.status()).toBe(201);
	await expect(page.getByText(/Run:/)).toBeVisible();
	await page.getByRole("button", { name: "Step 100 ms" }).click();
	await expect(page.getByText(/simulation: 100 ms/)).toBeVisible();
	await page.getByRole("button", { name: "Run" }).click();
	await expect(page.getByText(/Status: running/)).toBeVisible();
	await page.getByRole("button", { name: "Pause", exact: true }).click();
	await expect(page.getByText(/Status: paused/)).toBeVisible();
	const beforeReset = await page.getByText(/Run:/).textContent();
	await page.getByRole("button", { name: "Reset" }).click();
	await expect
		.poll(() => page.getByText(/Run:/).textContent())
		.not.toBe(beforeReset);
});
