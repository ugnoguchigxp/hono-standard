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

test("game checkpoints survive a browser reload", async ({ page }) => {
	test.setTimeout(50_000);
	await page.goto("/game");
	await expect(page.getByRole("heading", { name: "Login required" })).toBeVisible();
	await page.getByRole("main").getByRole("link", { name: "Login" }).click();
	await expect(page).toHaveURL(/\/login\?redirect=%2Fgame/);

	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();

	await expect(page).toHaveURL(/\/game$/);
	await expect(
		page.getByRole("heading", { name: "The signal is waiting." }),
	).toBeVisible();
	await expect(page.getByText("No checkpoint found.")).toBeVisible();
	await page.getByRole("button", { name: "New Game" }).click();
	await expect(page.getByRole("heading", { name: "Signal Ruins" })).toBeVisible();
	await expect(page.locator("canvas")).toBeVisible();
	await expect(page.getByRole("status")).toHaveText("Initial checkpoint saved.");

	await page.locator("canvas").click();
	const pressGameKey = async (key: string, settleMs = 90) => {
		await page.keyboard.down(key);
		await page.waitForTimeout(45);
		await page.keyboard.up(key);
		await page.waitForTimeout(settleMs);
	};
	const move = async (key: string, count: number) => {
		for (let step = 0; step < count; step += 1) {
			await pressGameKey(key, 125);
		}
	};

	await move("ArrowDown", 3);
	await move("ArrowRight", 11);
	await move("ArrowUp", 4);
	await page.waitForTimeout(500);
	await pressGameKey("Enter", 180);
	await pressGameKey("Enter", 500);

	for (let attempt = 0; attempt < 28; attempt += 1) {
		await pressGameKey("ArrowDown", 40);
		await pressGameKey("Enter", 350);
		if ((await page.getByRole("status").textContent()) === "Checkpoint saved.") {
			break;
		}
	}
	await expect(page.getByRole("status")).toHaveText("Checkpoint saved.");

	const savedState = await page.evaluate(() => {
		const raw = window.localStorage.getItem(
			"echoes-at-dawn:autosave:admin%40example.com",
		);
		return raw ? JSON.parse(raw).state : null;
	});
	expect(savedState).toMatchObject({
		schemaVersion: 2,
		mode: "field",
		currentMap: { checkpoint: { x: 14, y: 5 } },
		story: { flags: { "signal-ruins-cleared": true } },
		battle: null,
	});

	await page.reload();
	await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
	await page.getByRole("button", { name: "Continue" }).click();
	await expect(page.locator("canvas")).toBeVisible();
	await expect(page.getByRole("status")).toHaveText("Checkpoint loaded.");
});
