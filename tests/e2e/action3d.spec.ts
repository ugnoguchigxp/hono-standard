import { chromium, expect, type Page, test } from "@playwright/test";

const loginToAction3d = async (page: Page) => {
	await page.goto("/games/action-3d");
	await page.getByRole("main").getByRole("link", { name: "Login" }).click();
	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();
	await expect(page).toHaveURL(/\/games\/action-3d$/);
};

const measureAnimationFrames = (page: Page, runs: number, frameCount: number) =>
	page.evaluate(
		async ({ runs, frameCount }) => {
			const longTasks: number[] = [];
			let observer: PerformanceObserver | null = null;
			if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
				observer = new PerformanceObserver((entries) => {
					longTasks.push(...entries.getEntries().map((entry) => entry.duration));
				});
				observer.observe({ type: "longtask" });
			}
			const summaries: Array<{
				medianMs: number;
				p95Ms: number;
				maxMs: number;
			}> = [];
			for (let run = 0; run < runs; run += 1) {
				const deltas = await new Promise<number[]>((resolve) => {
					const values: number[] = [];
					let previous = 0;
					const frame = (now: number) => {
						if (previous) values.push(now - previous);
						previous = now;
						if (values.length >= frameCount) resolve(values);
						else requestAnimationFrame(frame);
					};
					requestAnimationFrame(frame);
				});
				const sorted = [...deltas].sort((a, b) => a - b);
				summaries.push({
					medianMs: sorted[Math.floor(sorted.length / 2)],
					p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
					maxMs: sorted.at(-1) ?? 0,
				});
			}
			observer?.disconnect();
			return { summaries, longTasks };
		},
		{ runs, frameCount },
	);

test("Action3D WebGL movement, combat victory, and checkpoint Continue", async ({
	page,
}) => {
	test.setTimeout(45_000);
	await loginToAction3d(page);
	await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();
	await page.getByRole("button", { name: "New Game" }).click();
	const game = page.locator("main.action3d-game");
	await expect(game).toHaveAttribute("data-action3d-phase", "playing");
	await expect(page.locator("canvas.action3d-canvas")).toBeVisible();
	await expect(page.getByLabel("Runtime performance")).not.toContainText("0 FPS");

	const startZ = Number(await game.getAttribute("data-action3d-player-z"));
	await page.keyboard.down("w");
	await page.waitForTimeout(1_200);
	await page.keyboard.up("w");
	await expect
		.poll(async () => Number(await game.getAttribute("data-action3d-player-z")))
		.toBeGreaterThan(startZ + 3);

	// The sentinels converge on the player. Each lock-on cycle selects the
	// nearest active target, and two landed attacks defeat one sentinel.
	for (let target = 0; target < 5; target += 1) {
		if ((await game.getAttribute("data-action3d-phase")) !== "playing") break;
		await page.waitForTimeout(900);
		await page.keyboard.press("e");
		for (let attack = 0; attack < 3; attack += 1) {
			await page.keyboard.press("f");
			await page.waitForTimeout(580);
		}
	}
	if (Number(await game.getAttribute("data-action3d-enemies")) > 0) {
		await page.keyboard.down("w");
		await page.waitForTimeout(1_800);
		await page.keyboard.up("w");
		await page.keyboard.press("e");
		for (let attack = 0; attack < 6; attack += 1) {
			await page.keyboard.press("f");
			await page.waitForTimeout(580);
		}
	}
	await expect(game).toHaveAttribute("data-action3d-phase", "victory", {
		timeout: 8_000,
	});
	await expect(page.locator("canvas.action3d-canvas")).toHaveAttribute(
		"data-action3d-defeated-settled",
		"3",
		{ timeout: 3_000 },
	);
	await expect(
		page.getByRole("heading", { name: "Field secured" }),
	).toBeVisible();
	await expect(page.getByText(/checkpoint saved/i).first()).toBeVisible();
	const saved = await page.evaluate(() => {
		const raw = window.localStorage.getItem(
			"action-3d:checkpoint:admin%40example.com",
		);
		return raw ? JSON.parse(raw).state : null;
	});
	expect(saved).toMatchObject({
		schemaVersion: 1,
		phase: "victory",
		location: {
			worldId: "aether-courtyard",
			checkpointId: "north-beacon",
		},
	});

	await page.reload();
	await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
	await page.getByRole("button", { name: "Continue" }).click();
	await expect(game).toHaveAttribute("data-action3d-phase", "victory");
	await expect(page.locator("canvas.action3d-canvas")).toBeVisible();
});

test("Action3D manifest Retry and missing-model fallback are recoverable", async ({
	page,
}) => {
	let failManifest = true;
	await page.route(
		"**/action3d-content/action3d-field-lab-1/manifest.json",
		async (route) => {
			if (failManifest)
				await route.fulfill({ status: 503, body: "unavailable" });
			else await route.continue();
		},
	);
	await loginToAction3d(page);
	await expect(page.getByRole("alert")).toContainText("World load failed");
	failManifest = false;
	await page.getByRole("button", { name: "Retry" }).click();
	await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();

	await page.route("**/assets/action3d/characters/aether-runner.glb", async (route) => {
		await route.fulfill({ status: 404, body: "missing" });
	});
	await page.getByRole("button", { name: "New Game" }).click();
	await expect(page.locator("canvas.action3d-canvas")).toBeVisible();
	await expect(page.locator(".action3d-warning")).toContainText(
		"procedural fallback is active",
	);
	const canvas = page.locator("canvas.action3d-canvas");
	await expect(canvas).toHaveAttribute("data-runtime-generation", "0");
	await canvas.dispatchEvent("webglcontextlost");
	await expect(
		page.getByRole("heading", { name: "Runtime interrupted" }),
	).toBeVisible();
	await page.getByRole("button", { name: "Retry checkpoint" }).click();
	await expect(page.locator("canvas.action3d-canvas")).toHaveAttribute(
		"data-runtime-generation",
		"1",
	);
});

test("Action3D heavy runtime and assets remain route- and launch-isolated", async ({
	page,
}) => {
	test.setTimeout(30_000);
	const requests: string[] = [];
	page.on("request", (request) => requests.push(request.url()));
	await page.goto("/");
	expect(requests.some((url) => /Action3dGame|PhaserGame|aether-(runner|sentinel)\.glb/.test(url))).toBe(false);

	await loginToAction3d(page);
	expect(requests.some((url) => /Action3dGame|aether-(runner|sentinel)\.glb/.test(url))).toBe(false);
	await page.getByRole("button", { name: "New Game" }).click();
	await expect(page.locator("canvas.action3d-canvas")).toBeVisible();
	await expect.poll(() => requests.some((url) => /Action3dGame/.test(url))).toBe(true);
	await expect.poll(() => requests.some((url) => /aether-runner\.glb/.test(url))).toBe(true);
	await expect.poll(() => requests.some((url) => /aether-sentinel\.glb/.test(url))).toBe(true);
	expect(requests.some((url) => /PhaserGame/.test(url))).toBe(false);
	for (let cycle = 0; cycle < 10; cycle += 1) {
		await expect(page.locator("canvas.action3d-canvas")).toHaveCount(1);
		await page.getByRole("button", { name: "Field Lab" }).click();
		await expect(page.locator("canvas.action3d-canvas")).toHaveCount(0);
		await page.getByRole("button", { name: "New Game" }).click();
	}
	await expect(page.locator("canvas.action3d-canvas")).toHaveCount(1);
});

test("Action3D keeps a corrupt checkpoint intact while New Game stays available", async ({
	page,
}) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			"action-3d:checkpoint:admin%40example.com",
			"{corrupt",
		);
	});
	await loginToAction3d(page);
	await expect(page.getByText(/not valid JSON/)).toBeVisible();
	await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
	await page.getByRole("button", { name: "New Game" }).click();
	await expect(page.locator("canvas.action3d-canvas")).toBeVisible();
	expect(
		await page.evaluate(() =>
			window.localStorage.getItem(
				"action-3d:checkpoint:admin%40example.com",
			),
		),
	).toBe("{corrupt");
});

test("Action3D production slice records desktop and compact viewport budgets", async ({
	baseURL,
}, testInfo) => {
	test.setTimeout(30_000);
	const isolatedBrowser = await chromium.launch();
	try {
		const context = await isolatedBrowser.newContext({
			baseURL: baseURL ?? "http://127.0.0.1:5174",
			viewport: { width: 1280, height: 720 },
		});
		const page = await context.newPage();
		await loginToAction3d(page);
		await page.getByRole("button", { name: "New Game" }).click();
		const game = page.locator("main.action3d-game");
		await expect(page.locator("canvas.action3d-canvas")).toBeVisible();
		await expect(game).not.toHaveAttribute("data-action3d-fps", "0");
		await page.waitForTimeout(1_000);
		const desktop = await measureAnimationFrames(page, 3, 90);
		for (const run of desktop.summaries)
			expect(run.p95Ms).toBeLessThanOrEqual(20.5);

		await page.setViewportSize({ width: 390, height: 844 });
		const compact = await measureAnimationFrames(page, 3, 60);
		for (const run of compact.summaries)
			expect(run.p95Ms).toBeLessThanOrEqual(33.3);
		const runtime = await game.evaluate((element) => ({
			fps: element.getAttribute("data-action3d-fps"),
			frameTimeMs: element.getAttribute("data-action3d-frame-ms"),
			drawCalls: element.getAttribute("data-action3d-draw-calls"),
			activeMeshes: element.getAttribute("data-action3d-active-meshes"),
			resources: performance
				.getEntriesByType("resource")
				.filter((entry) => /Action3dGame|aether-(runner|sentinel)\.glb/.test(entry.name))
				.map((entry) => ({
					name: entry.name.split("/").at(-1),
					durationMs: Math.round(entry.duration * 10) / 10,
					transferSize: (entry as PerformanceResourceTiming).transferSize,
				})),
		}));
		const cdp = await context.newCDPSession(page);
		await cdp.send("Performance.enable");
		const cdpMetrics = await cdp.send("Performance.getMetrics");
		const metric = (name: string) =>
			cdpMetrics.metrics.find((item) => item.name === name)?.value ?? null;
		const memory = {
			jsHeapUsedBytes: metric("JSHeapUsedSize"),
			jsHeapTotalBytes: metric("JSHeapTotalSize"),
			domNodes: metric("Nodes"),
		};
		await testInfo.attach("action3d-performance.json", {
			body: Buffer.from(
				JSON.stringify({ desktop, compact, runtime, memory }, null, 2),
			),
			contentType: "application/json",
		});
	} finally {
		await isolatedBrowser.close();
	}
});
