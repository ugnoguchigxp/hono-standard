import { expect, test } from "@playwright/test";

test("public screens render", async ({ page }) => {
	await page.goto("/");
	await expect(
		page.getByRole("heading", { name: "Welcome to Hono Standard" }),
	).toBeVisible();
	await expect(page.getByRole("link", { name: "Action3D" })).toHaveAttribute(
		"href",
		"/games/action-3d",
	);

	await page.goto("/login");
	await expect(page.getByRole("heading", { name: "Hono Standard" })).toBeVisible();
	await expect(page.getByLabel("Email")).toBeVisible();
	await expect(page.getByLabel("Password")).toBeVisible();

	await page.goto("/showcase?page=1&pageSize=10");
	await expect(page.getByRole("heading", { name: "Component Showcase" })).toBeVisible();
});

test("Action3D is protected and loads as an independent route", async ({
	page,
}) => {
	await page.goto("/games/action-3d");
	await expect(page.getByRole("heading", { name: "Login required" })).toBeVisible();
	await page.getByRole("main").getByRole("link", { name: "Login" }).click();
	await expect(page).toHaveURL(/\/login\?redirect=%2Fgames%2Faction-3d/);

	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();

	await expect(page).toHaveURL(/\/games\/action-3d$/);
	await expect(
		page.getByRole("heading", { name: "Action3D Field Lab" }),
	).toBeVisible();
	await expect(page.getByRole("link", { name: "Action3D" })).toHaveClass(
		/active/,
	);
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

test("game choices and the second-world checkpoint survive a browser reload", async ({
	page,
}) => {
	test.setTimeout(80_000);
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
	const gameHost = page.getByTestId("game-canvas-host");
	const pressGameKey = async (key: string, settleMs = 90) => {
		await page.keyboard.down(key);
		await page.waitForTimeout(45);
		await page.keyboard.up(key);
		await page.waitForTimeout(settleMs);
	};
	const finishBattle = async () => {
		await page.waitForTimeout(350);
		// Battle presentation pauses the ATB timeline during each visible action, so
		// the command budget must include those animation windows as well as gauge time.
		for (let attempt = 0; attempt < 90; attempt += 1) {
			if ((await gameHost.getAttribute("data-game-mode")) !== "battle") return;
			await pressGameKey("ArrowDown", 40);
			await pressGameKey("Enter", 300);
		}
		throw new Error("Battle did not finish within the command budget.");
	};
	let randomBattleCount = 0;
	const move = async (key: string, count: number) => {
		for (let step = 0; step < count; step += 1) {
			await pressGameKey(key, 125);
			if ((await gameHost.getAttribute("data-game-mode")) === "battle") {
				randomBattleCount += 1;
				await finishBattle();
				await expect(gameHost).toHaveAttribute("data-game-mode", "field");
			}
		}
	};

	// Open the field-only menu, visit each view, switch the selected party
	// member, then close it before continuing the original field route.
	await pressGameKey("x", 40);
	await pressGameKey("Enter", 40);
	await pressGameKey("ArrowRight", 40);
	await pressGameKey("Escape", 40);
	await pressGameKey("ArrowDown", 40);
	await pressGameKey("Enter", 40);
	await pressGameKey("Escape", 40);
	await pressGameKey("ArrowDown", 40);
	await pressGameKey("Enter", 40);
	await pressGameKey("ArrowDown", 40);
	await pressGameKey("Escape", 40);
	await pressGameKey("Escape", 80);

	await move("ArrowRight", 23);
	await move("ArrowUp", 14);
	expect(randomBattleCount).toBe(1);
	await page.waitForTimeout(500);
	await pressGameKey("Enter", 180);
	await pressGameKey("Enter", 500);

	await finishBattle();
	await expect(page.getByRole("status")).toHaveText("Checkpoint saved.");

	await move("ArrowRight", 3);
	await move("ArrowUp", 1);
	await expect(page.getByRole("heading", { name: "Relay Camp" })).toBeVisible();
	// The React heading follows session state immediately, while Phaser finishes
	// the map fade/restart 260 ms later. Wait until the new scene accepts input.
	await page.waitForTimeout(350);
	await move("ArrowRight", 8);
	await move("ArrowDown", 1);
	await page.waitForTimeout(350);
	await pressGameKey("Enter", 120);
	await pressGameKey("Enter", 120);
	await pressGameKey("Enter", 350);
	await expect(page.getByRole("status")).toHaveText("Checkpoint saved.");

	const savedState = await page.evaluate(() => {
		const raw = window.localStorage.getItem(
			"echoes-at-dawn:autosave:admin%40example.com",
		);
		return raw ? JSON.parse(raw).state : null;
	});
	expect(savedState).toMatchObject({
		schemaVersion: 4,
		mode: "field",
		location: { mapId: "relay-camp", checkpointId: "relay-center" },
		story: {
			flags: {
				"signal-ruins-cleared": true,
				"relay-plan-mira": true,
				"relay-council-complete": true,
			},
			relationships: { "mira:sol": 10 },
		},
		battle: null,
	});

	await page.reload();
	await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
	await page.getByRole("button", { name: "Continue" }).click();
	await expect(page.locator("canvas")).toBeVisible();
	await expect(page.getByRole("heading", { name: "Relay Camp" })).toBeVisible();
	await expect(page.getByRole("status")).toHaveText("Checkpoint loaded.");
	await expect(gameHost).toHaveAttribute("data-game-mode", "field");
	await page.locator("canvas").click();
	await move("ArrowRight", 3);
	await expect(gameHost).toHaveAttribute("data-game-mode", "event");
	await page.waitForTimeout(350);
	await pressGameKey("Enter", 180);
	await expect(gameHost).toHaveAttribute("data-game-mode", "field");
});

test("world and asset loading failures recover through Retry", async ({ page }) => {
	test.setTimeout(35_000);
	await page.goto("/game");
	await page.getByRole("main").getByRole("link", { name: "Login" }).click();
	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();
	await expect(page).toHaveURL(/\/game$/);

	let failManifest = true;
	await page.route("**/game-content/data-driven-world-1/manifest.json", async (route) => {
		if (failManifest) {
			await route.fulfill({ status: 503, body: "unavailable" });
		} else {
			await route.continue();
		}
	});
	await page.reload();
	await expect(
		page.getByRole("heading", { name: "The world could not be loaded." }),
	).toBeVisible();
	failManifest = false;
	await page.getByRole("button", { name: "Retry" }).click();
	await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();

	let failAsset = true;
	await page.route("**/assets/game/backgrounds/signal-ruins-field.png", async (route) => {
		if (failAsset) {
			await route.fulfill({ status: 404, body: "missing" });
		} else {
			await route.continue();
		}
	});
	await page.getByRole("button", { name: "New Game" }).click();
	await expect(page.getByRole("alert")).toContainText("required world image");
	failAsset = false;
	await page.getByRole("button", { name: "Retry" }).click();
	await expect(page.locator("canvas")).toBeVisible();
});
