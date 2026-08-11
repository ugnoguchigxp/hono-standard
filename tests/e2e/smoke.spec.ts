import { expect, test, type Page } from "@playwright/test";

const resetRpgSave = async (page: Page) => {
	const status = await page.evaluate(async () => {
		const response = await fetch("/api/games/echoes-at-dawn/saves/autosave", {
			method: "DELETE",
		});
		window.localStorage.removeItem(
			"echoes-at-dawn:autosave:admin%40example.com",
		);
		window.localStorage.removeItem(
			"echoes-at-dawn:autosave:admin%40example.com:pending-cloud-writes",
		);
		return response.status;
	});
	expect(status).toBe(200);
};

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

test("field map renders its registered background instead of Phaser's missing texture", async ({
	page,
}) => {
	await page.goto("/game");
	await page.getByRole("main").getByRole("link", { name: "Login" }).click();
	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();
	await expect(page).toHaveURL(/\/game$/);
	await resetRpgSave(page);
	await page.reload();
	await page.getByRole("button", { name: "New Game" }).click();

	const fieldCanvas = page.locator("canvas");
	await expect(fieldCanvas).toHaveAttribute("data-map-background", "ready");
	await expect(fieldCanvas).toHaveAttribute(
		"data-map-background-id",
		"signal-ruins-world-v2",
	);
	await expect(fieldCanvas).toHaveAttribute(
		"data-audio-track",
		"bgm-field-signal-ruins",
	);
	await fieldCanvas.click();
	await expect(fieldCanvas).toHaveAttribute("data-audio-state", "ready");
	await expect(fieldCanvas).toHaveAttribute("data-audio-playback", "playing");
	const codecSupport = await page.evaluate(() => {
		const audio = document.createElement("audio");
		return {
			opus: audio.canPlayType('audio/ogg; codecs="opus"'),
			mp3: audio.canPlayType("audio/mpeg"),
		};
	});
	expect(codecSupport.opus).not.toBe("");
	expect(codecSupport.mp3).not.toBe("");
	const missingTextureRatio = await fieldCanvas.evaluate((canvas) => {
		const fieldCanvasElement = canvas as HTMLCanvasElement;
		const context = fieldCanvasElement.getContext("2d", {
			willReadFrequently: true,
		});
		if (!context) return 1;
		const pixels = context.getImageData(
			0,
			0,
			fieldCanvasElement.width,
			fieldCanvasElement.height,
		).data;
		let sampledPixels = 0;
		let missingGreenPixels = 0;
		for (let index = 0; index < pixels.length; index += 4 * 8) {
			sampledPixels += 1;
			if (
				pixels[index] === 0 &&
				pixels[index + 1] === 255 &&
				pixels[index + 2] === 0
			) {
				missingGreenPixels += 1;
			}
		}
		return missingGreenPixels / sampledPixels;
	});
	expect(missingTextureRatio).toBeLessThan(0.001);

	await page.getByRole("button", { name: "Settings" }).click();
	await expect(
		page.getByRole("dialog", { name: "Game settings" }),
	).toBeVisible();
	await page.getByLabel("Screen scale").selectOption("3");
	await page.getByLabel("High contrast").check();
	await page.getByLabel("Mute all audio").check();
	await expect(fieldCanvas).toHaveAttribute("data-audio-muted", "true");
	await page.getByRole("button", { name: "Close settings" }).click();
	await page.setViewportSize({ width: 375, height: 760 });
	const hostBounds = await page.getByTestId("game-canvas-host").boundingBox();
	expect(hostBounds).not.toBeNull();
	expect(hostBounds?.width ?? 376).toBeLessThanOrEqual(375);
	await expect(page.getByRole("button", { name: "Up" })).toBeVisible();
});

test("a failed on-demand map transition resumes after runtime Retry", async ({
	page,
}) => {
	await page.goto("/game");
	await page.getByRole("main").getByRole("link", { name: "Login" }).click();
	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();
	await expect(page).toHaveURL(/\/game$/);
	await resetRpgSave(page);
	await page.reload();
	await page.getByRole("button", { name: "New Game" }).click();
	await expect(page.getByRole("status")).toHaveText("Initial checkpoint saved.");

	await page.evaluate(async () => {
		const key = "echoes-at-dawn:autosave:admin%40example.com";
		const currentResponse = await fetch(
			"/api/games/echoes-at-dawn/saves/autosave",
		);
		if (!currentResponse.ok) throw new Error("Could not load the checkpoint.");
		const current = await currentResponse.json();
		if (!current.save) throw new Error("Expected the initial checkpoint.");
		const save = current.save.save;
		save.state.mode = "field";
		save.state.location = {
			mapId: "signal-ruins",
			entranceId: "relay-return",
			checkpointId: "signal-core",
		};
		save.state.field = {
			partyPositions: [
				{ x: 33, y: 3 },
				{ x: 32, y: 3 },
				{ x: 31, y: 3 },
			],
			facing: "RIGHT",
			pendingTriggerId: null,
			stepsSinceEncounter: 0,
		};
		save.state.event = null;
		save.state.battle = null;
		save.state.story.flags["signal-ruins-cleared"] = true;
		save.state.revision += 1;
		save.savedAt = new Date().toISOString();
		const updateResponse = await fetch(
			"/api/games/echoes-at-dawn/saves/autosave",
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					save,
					expectedRevision: current.save.revision,
					idempotencyKey: crypto.randomUUID(),
				}),
			},
		);
		if (!updateResponse.ok) {
			throw new Error(`Could not update checkpoint: ${updateResponse.status}`);
		}
		window.localStorage.removeItem(key);
	});
	await page.reload();
	await page.getByRole("button", { name: "Continue" }).click();

	let failRelayMap = true;
	await page.route(
		"**/game-content/data-driven-world-1/maps/relay-camp.json",
		async (route) => {
			if (failRelayMap) {
				await route.fulfill({ status: 503, body: "unavailable" });
			} else {
				await route.continue();
			}
		},
	);
	const canvas = page.locator("canvas");
	await expect(canvas).toHaveAttribute("data-map-background", "ready");
	await canvas.click();
	await page.keyboard.down("ArrowRight");
	await page.waitForTimeout(80);
	await page.keyboard.up("ArrowRight");
	await expect(page.getByRole("alert")).toContainText(
		"World data request failed with status 503.",
	);

	failRelayMap = false;
	await page.getByRole("button", { name: "Retry" }).click();
	await expect(page.getByRole("heading", { name: "Relay Camp" })).toBeVisible();
	await expect(canvas).toHaveAttribute("data-map-background-id", "relay-camp-field");
	await expect(canvas).toHaveAttribute("data-map-background", "ready");
});

test("game choices and the second-world checkpoint survive a browser reload", async ({
	page,
}) => {
	test.setTimeout(120_000);
	await page.goto("/game");
	await expect(page.getByRole("heading", { name: "Login required" })).toBeVisible();
	await page.getByRole("main").getByRole("link", { name: "Login" }).click();
	await expect(page).toHaveURL(/\/login\?redirect=%2Fgame/);

	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();

	await expect(page).toHaveURL(/\/game$/);
	await resetRpgSave(page);
	await page.reload();
	await expect(
		page.getByRole("heading", { name: "The signal is waiting." }),
	).toBeVisible();
	await expect(page.getByText("No checkpoint found.")).toBeVisible();
	await page.getByRole("button", { name: "New Game" }).click();
	await expect(page.getByRole("heading", { name: "Signal Ruins" })).toBeVisible();
	const fieldCanvas = page.locator("canvas");
	await expect(fieldCanvas).toBeVisible();
	await expect(fieldCanvas).toHaveAttribute("data-map-background", "ready");
	await expect(fieldCanvas).toHaveAttribute(
		"data-map-background-id",
		"signal-ruins-world-v2",
	);
	await expect(page.getByRole("status")).toHaveText("Initial checkpoint saved.");

	await fieldCanvas.click();
	const gameHost = page.getByTestId("game-canvas-host");
	const pressGameKey = async (key: string, settleMs = 90) => {
		await page.keyboard.down(key);
		await page.waitForTimeout(45);
		await page.keyboard.up(key);
		await page.waitForTimeout(settleMs);
	};
	const finishBattle = async () => {
		await page.waitForTimeout(350);
		const phaseCounts: Record<string, number> = {};
		for (let attempt = 0; attempt < 420; attempt += 1) {
			if ((await gameHost.getAttribute("data-game-mode")) !== "battle") return;
			const phase =
				(await gameHost.getAttribute("data-battle-phase")) ?? "missing";
			phaseCounts[phase] = (phaseCounts[phase] ?? 0) + 1;
			if (phase === "awaiting-command") {
				// Attack opens target selection; the second confirm attacks the default target.
				await pressGameKey("Enter", 40);
				await pressGameKey("Enter", 360);
			} else if (phase === "victory" || phase === "escaped") {
				// The final action animation may still hold the first confirmation.
				await pressGameKey("Enter", 420);
			} else if (phase === "defeat") {
				await pressGameKey("Enter", 420);
			} else {
				await page.waitForTimeout(180);
			}
		}
		throw new Error(
			`Battle did not finish within the command budget: ${JSON.stringify(phaseCounts)}.`,
		);
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
	await expect(gameHost).toHaveAttribute("data-game-mode", "event");
	for (let advance = 0; advance < 3; advance += 1) {
		if ((await gameHost.getAttribute("data-game-mode")) === "battle") break;
		await pressGameKey("Enter", 250);
	}
	await expect(gameHost).toHaveAttribute("data-game-mode", "battle");

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
		schemaVersion: 5,
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
	if (await page.getByRole("heading", { name: "Login required" }).isVisible()) {
		await page.getByRole("main").getByRole("link", { name: "Login" }).click();
		await page.getByLabel("Email").fill("admin@example.com");
		await page.getByLabel("Password").fill("password123456");
		await page.getByRole("button", { name: /ログイン/ }).click();
		await expect(page).toHaveURL(/\/game$/);
	}
	await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
	await page.getByRole("button", { name: "Continue" }).click();
	await expect(page.locator("canvas")).toBeVisible();
	await expect(page.getByRole("heading", { name: "Relay Camp" })).toBeVisible();
	await expect(page.getByRole("status")).toHaveText("Checkpoint loaded.");
	await expect(gameHost).toHaveAttribute("data-game-mode", "field");
	await expect(page.locator("canvas")).toHaveAttribute(
		"data-map-background",
		"ready",
	);
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
	await resetRpgSave(page);
	await page.reload();

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
	await page.route("**/assets/game/backgrounds/signal-ruins-world-v2.png", async (route) => {
		if (failAsset) {
			await route.fulfill({ status: 404, body: "missing" });
		} else {
			await route.continue();
		}
	});
	await page.getByRole("button", { name: "New Game" }).click();
	await expect(page.getByRole("alert")).toContainText("required game asset");
	failAsset = false;
	await page.getByRole("button", { name: "Retry" }).click();
	await expect(page.locator("canvas")).toHaveAttribute(
		"data-map-background",
		"ready",
	);
});

test("an account checkpoint continues in a separate browser context", async ({
	page,
	browser,
}) => {
	await page.goto("/game");
	await page.getByRole("main").getByRole("link", { name: "Login" }).click();
	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();
	await expect(page).toHaveURL(/\/game$/);
	await resetRpgSave(page);
	await page.reload();
	await page.getByRole("button", { name: "New Game" }).click();
	await expect(page.getByRole("status")).toHaveText("Initial checkpoint saved.");

	const otherContext = await browser.newContext();
	try {
		expect((await otherContext.storageState()).origins).toEqual([]);
		const otherPage = await otherContext.newPage();
		await otherPage.goto("/game");
		await otherPage
			.getByRole("main")
			.getByRole("link", { name: "Login" })
			.click();
		await otherPage.getByLabel("Email").fill("admin@example.com");
		await otherPage.getByLabel("Password").fill("password123456");
		await otherPage.getByRole("button", { name: /ログイン/ }).click();
		await expect(otherPage).toHaveURL(/\/game$/);
		await expect(
			otherPage.getByRole("button", { name: "Continue" }),
		).toBeVisible();
		await expect(otherPage.getByText(/Cloud save/)).toBeVisible();
		await otherPage.getByRole("button", { name: "Continue" }).click();
		await expect(
			otherPage.getByRole("heading", { name: "Signal Ruins" }),
		).toBeVisible();
		await expect(otherPage.getByRole("status")).toHaveText(
			"Checkpoint loaded.",
		);
	} finally {
		await otherContext.close();
	}
});
