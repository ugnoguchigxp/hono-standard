import { type BrowserContext, expect, type Page, test } from "@playwright/test";

const PLAYER_EMAIL = "admin@example.com";
const LOCAL_SAVE_KEY = "echoes-at-dawn:autosave:admin%40example.com";
const PENDING_SAVE_KEY = `${LOCAL_SAVE_KEY}:pending-cloud-writes`;

const login = async (page: Page) => {
	await page.goto("/game");
	const loginLink = page.getByRole("main").getByRole("link", { name: "Login" });
	const launcherAction = page
		.getByRole("button", { name: /New Game|Continue/ })
		.first();
	await expect(loginLink.or(launcherAction).first()).toBeVisible({
		timeout: 15_000,
	});
	if (await loginLink.isVisible()) {
		await loginLink.click();
		await page.getByLabel("Email").fill(PLAYER_EMAIL);
		await page.getByLabel("Password").fill("password123456");
		await page.getByRole("button", { name: /ログイン/ }).click();
	}
	await expect(page).toHaveURL(/\/game$/);
	await expect(launcherAction).toBeVisible({ timeout: 15_000 });
};

const clearRpgSaves = async (page: Page) => {
	const statuses = await page.evaluate(async () => {
		const slots = ["autosave", "manual-1", "manual-2", "manual-3"];
		const responses = await Promise.all(
			slots.map((slot) =>
				fetch(`/api/games/echoes-at-dawn/saves/${slot}`, {
					method: "DELETE",
					headers: { "X-Game-Save-Owner": "admin@example.com" },
				}),
			),
		);
		window.localStorage.clear();
		return responses.map(({ status }) => status);
	});
	expect(statuses).toEqual([200, 200, 200, 200]);
};

const startCleanGame = async (page: Page) => {
	await login(page);
	await clearRpgSaves(page);
	await page.reload();
	await page.getByRole("button", { name: "New Game" }).click();
	await expect(page.getByRole("status")).toHaveText("Initial checkpoint saved.");
	const canvas = page.locator("canvas");
	await expect(canvas).toHaveAttribute("data-map-background", "ready");
	await canvas.click();
	return canvas;
};

const openAuthenticatedContext = async (
	context: BrowserContext,
): Promise<Page> => {
	const page = await context.newPage();
	await login(page);
	return page;
};

const pressGameKey = async (page: Page, key: string, settleMs = 80) => {
	await page.keyboard.down(key);
	await page.waitForTimeout(50);
	await page.keyboard.up(key);
	await page.waitForTimeout(settleMs);
};

test("Phaser and Action3D remain isolated until their launch boundaries", async ({
	page,
}) => {
	const requests: string[] = [];
	page.on("request", (request) => requests.push(request.url()));
	await page.goto("/");
	expect(requests.some((url) => /PhaserGame|Action3dGame/.test(url))).toBe(false);

	await login(page);
	await expect(
		page.getByRole("button", { name: /New Game|Continue/ }).first(),
	).toBeVisible();
	expect(requests.some((url) => /PhaserGame|Action3dGame/.test(url))).toBe(false);
	await clearRpgSaves(page);
	await page.reload();
	await page.getByRole("button", { name: "New Game" }).click();
	await expect.poll(() => requests.some((url) => /PhaserGame/.test(url))).toBe(true);
	expect(requests.some((url) => /Action3dGame/.test(url))).toBe(false);
});

test("a stale browser checkpoint requires an explicit two-browser resolution", async ({
	page,
	browser,
}) => {
	await startCleanGame(page);

	const otherContext = await browser.newContext();
	try {
		const otherPage = await openAuthenticatedContext(otherContext);
		await expect(otherPage.getByRole("button", { name: "Continue" })).toBeVisible();

		const cloudAdvanced = await page.evaluate(async () => {
			const currentResponse = await fetch(
				"/api/games/echoes-at-dawn/saves/autosave",
			);
			const current = await currentResponse.json();
			const save = structuredClone(current.save.save);
			save.state.revision += 1;
			save.state.field.stepsSinceEncounter += 1;
			save.savedAt = new Date().toISOString();
			const response = await fetch(
				"/api/games/echoes-at-dawn/saves/autosave",
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						protocolVersion: 2,
						intent: "advance",
						save,
						baseRevision: current.save.revision,
						expectedRevision: current.save.revision,
						idempotencyKey: crypto.randomUUID(),
					}),
				},
			);
			return { ok: response.ok, revision: current.save.revision };
		});
		expect(cloudAdvanced.ok).toBe(true);

		await otherPage.evaluate(
			({ localKey, pendingKey, baseRevision }) => {
				const raw = window.localStorage.getItem(localKey);
				if (!raw) throw new Error("Expected a browser checkpoint.");
				const browserSave = JSON.parse(raw);
				browserSave.state.revision += 2;
				browserSave.savedAt = new Date().toISOString();
				window.localStorage.setItem(localKey, JSON.stringify(browserSave));
				window.localStorage.setItem(
					pendingKey,
					JSON.stringify({
						version: 2,
						writes: [
							{
								save: browserSave,
								idempotencyKey: crypto.randomUUID(),
								intent: "advance",
								baseRevision,
								expectedRevision: baseRevision,
							},
						],
					}),
				);
			},
			{
				localKey: LOCAL_SAVE_KEY,
				pendingKey: PENDING_SAVE_KEY,
				baseRevision: cloudAdvanced.revision,
			},
		);
		await otherPage.reload();

		await expect(
			otherPage.getByRole("alertdialog", {
				name: "Choose checkpoint progress",
			}),
		).toBeVisible();
		await expect(otherPage.getByLabel("Browser checkpoint")).toBeVisible();
		await expect(otherPage.getByLabel("Cloud checkpoint")).toBeVisible();
		await otherPage
			.getByRole("button", { name: "Use cloud progress" })
			.click();
		await expect(otherPage.getByRole("button", { name: "Continue" })).toBeVisible();
		expect(await otherPage.evaluate((key) => localStorage.getItem(key), PENDING_SAVE_KEY)).toBeNull();
	} finally {
		await otherContext.close();
	}
});

test("manual slot history can be restored and promoted to autosave", async ({
	page,
}) => {
	const canvas = await startCleanGame(page);
	await expect(page.locator(".game-frame")).toHaveScreenshot(
		"rpg-signal-ruins-field.png",
		{
			animations: "disabled",
			mask: [page.locator(".game-debug-overlay")],
			maskColor: "#07101d",
			maxDiffPixelRatio: 0.03,
		},
	);

	await pressGameKey(page, "x");
	for (let index = 0; index < 3; index += 1) {
		await pressGameKey(page, "ArrowDown");
	}
	await pressGameKey(page, "Enter");
	await expect(page.locator(".game-frame")).toHaveScreenshot(
		"rpg-manual-save-menu.png",
		{
			animations: "disabled",
			mask: [page.locator(".game-debug-overlay")],
			maskColor: "#07101d",
			maxDiffPixelRatio: 0.01,
		},
	);

	for (let save = 0; save < 2; save += 1) {
		await pressGameKey(page, "Enter");
		await pressGameKey(page, "Enter");
		await expect(page.getByRole("status")).toHaveText("manual-1 saved.");
	}

	const restoredRevision = await page.evaluate(async () => {
		const historyResponse = await fetch(
			"/api/games/echoes-at-dawn/saves/manual-1/history",
		);
		if (!historyResponse.ok) throw new Error("Manual history could not be read.");
		const { history } = await historyResponse.json();
		if (history.length !== 1) {
			throw new Error(`Expected one historical revision, received ${history.length}.`);
		}
		const currentResponse = await fetch(
			"/api/games/echoes-at-dawn/saves/manual-1",
		);
		const current = await currentResponse.json();
		const restoreResponse = await fetch(
			`/api/games/echoes-at-dawn/saves/manual-1/history/${history[0].revision}/restore`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					protocolVersion: 2,
					expectedRevision: current.save.revision,
					idempotencyKey: crypto.randomUUID(),
				}),
			},
		);
		if (!restoreResponse.ok) throw new Error("Manual history restore failed.");
		return (await restoreResponse.json()).save.revision as number;
	});
	expect(restoredRevision).toBe(3);

	await page.reload();
	await expect(page.getByRole("heading", { name: "Manual checkpoints" })).toBeVisible();
	await page.getByRole("button", { name: "Restore to autosave" }).click();
	await expect(page.getByRole("status")).toHaveText(
		"manual-1 restored to autosave.",
	);
	await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
	await page.getByRole("button", { name: "Continue" }).click();
	await expect(canvas).toHaveAttribute("data-map-background", "ready");
});
