import { chromium, expect, type Page, test } from "@playwright/test";

const loginToAction3d = async (page: Page, clearCloudSave = false) => {
	await page.goto("/games/action-3d");
	await page.getByRole("main").getByRole("link", { name: "Login" }).click();
	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();
	await expect(page).toHaveURL(/\/games\/action-3d$/);
	if (clearCloudSave) {
		const deletion = await page.evaluate(async () => {
			const response = await fetch("/api/games/action-3d/saves/checkpoint", {
				method: "DELETE",
				headers: { "X-Game-Save-Owner": "admin@example.com" },
			});
			return { ok: response.ok, status: response.status, body: await response.text() };
		});
		if (!deletion.ok)
			throw new Error(
				`Action3D checkpoint reset failed (${deletion.status}): ${deletion.body}`,
			);
		await page.evaluate(() => {
			const key = "action-3d:checkpoint:admin%40example.com";
			window.localStorage.removeItem(key);
			window.localStorage.removeItem(`${key}:pending-cloud-writes`);
		});
		await page.reload();
	}
};

const measureAnimationFrames = (page: Page, runs: number, frameCount: number) =>
	page.evaluate(
		async ({ runs, frameCount }) => {
			const collectFrames = (count: number) =>
				new Promise<number[]>((resolve) => {
					const values: number[] = [];
					let previous = 0;
					const frame = (now: number) => {
						if (previous) values.push(now - previous);
						previous = now;
						if (values.length >= count) resolve(values);
						else requestAnimationFrame(frame);
					};
					requestAnimationFrame(frame);
				});
			const measurementStartedAt = performance.now();
			const longTasks: Array<{ duration: number; startTime: number }> = [];
			const runWindows: Array<{ startTime: number; endTime: number }> = [];
			let observer: PerformanceObserver | null = null;
			if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
				observer = new PerformanceObserver((entries) => {
					longTasks.push(
						...entries.getEntries().map((entry) => ({
							duration: entry.duration,
							startTime: entry.startTime,
						})),
					);
				});
				observer.observe({ type: "longtask" });
			}
			const summaries: Array<{
				medianMs: number;
				p95Ms: number;
				maxMs: number;
			}> = [];
			for (let run = 0; run < runs; run += 1) {
				const startTime = performance.now();
				const deltas = await collectFrames(frameCount);
				runWindows.push({ startTime, endTime: performance.now() });
				const sorted = [...deltas].sort((a, b) => a - b);
				summaries.push({
					medianMs: sorted[Math.floor(sorted.length / 2)],
					p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
					maxMs: sorted.at(-1) ?? 0,
				});
			}
			if (observer) {
				longTasks.push(
					...observer.takeRecords().map((entry) => ({
						duration: entry.duration,
						startTime: entry.startTime,
					})),
				);
			}
			observer?.disconnect();
			return {
				summaries,
				longTasks: longTasks.map((task) => ({
					duration: task.duration,
					offsetMs: task.startTime - measurementStartedAt,
					runIndex: runWindows.findIndex(
						(window) =>
							task.startTime >= window.startTime &&
							task.startTime <= window.endTime,
					),
				})),
			};
		},
		{ runs, frameCount },
	);

const warmAnimationFrames = (page: Page, frameCount: number) =>
	page.evaluate(
		(count) =>
			new Promise<void>((resolve) => {
				let frames = 0;
				const frame = () => {
					frames += 1;
					if (frames >= count) resolve();
					else requestAnimationFrame(frame);
				};
				requestAnimationFrame(frame);
			}),
		frameCount,
	);

test("Action3D world transition, combat victory, and cross-browser Continue", async ({
	browser,
	page,
}) => {
	test.setTimeout(75_000);
	await loginToAction3d(page, true);
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
	const engageEnemies = async (maxCycles: number) => {
		for (let cycle = 0; cycle < maxCycles; cycle += 1) {
			if (
				(await game.getAttribute("data-action3d-phase")) !== "playing" ||
				Number(await game.getAttribute("data-action3d-enemies")) === 0
			)
				break;
			if (!(await game.getAttribute("data-action3d-lock-on"))) {
				await page.keyboard.down("w");
				await page.waitForTimeout(900);
				await page.keyboard.up("w");
				await page.keyboard.press("e");
				await page.waitForTimeout(250);
				if (!(await game.getAttribute("data-action3d-lock-on"))) continue;
			}
			await page.waitForTimeout(300);
			await page.keyboard.down("w");
			await page.waitForTimeout(1_400);
			await page.keyboard.up("w");
			await page.keyboard.press("q");
			await page.waitForTimeout(1_050);
			for (let attack = 0; attack < 2; attack += 1) {
				await page.keyboard.press("f");
				await page.waitForTimeout(580);
			}
			await page.keyboard.press("Space");
		}
	};
	const navigateTo = async (targetX: number, targetZ: number) => {
		const position = async () => ({
			x: Number(await game.getAttribute("data-action3d-player-x")),
			z: Number(await game.getAttribute("data-action3d-player-z")),
		});
		const moveFor = async (key: "w" | "a" | "s" | "d", duration: number) => {
			await page.keyboard.down(key);
			await page.waitForTimeout(duration);
			await page.keyboard.up(key);
		};
		const before = await position();
		await moveFor("w", 220);
		const after = await position();
		const length = Math.max(0.001, Math.hypot(after.x - before.x, after.z - before.z));
		const w = {
			x: (after.x - before.x) / length,
			z: (after.z - before.z) / length,
		};
		const directions = {
			w,
			s: { x: -w.x, z: -w.z },
			d: { x: w.z, z: -w.x },
			a: { x: -w.z, z: w.x },
		};
		for (let step = 0; step < 60; step += 1) {
			if ((await game.getAttribute("data-action3d-world")) !== "aether-courtyard")
				return;
			const current = await position();
			const target = { x: targetX - current.x, z: targetZ - current.z };
			if (Math.hypot(target.x, target.z) < 0.7) return;
			const key = (Object.entries(directions) as Array<
				["w" | "a" | "s" | "d", { x: number; z: number }]
			>).sort(
				([, left], [, right]) =>
					right.x * target.x + right.z * target.z -
					(left.x * target.x + left.z * target.z),
			)[0][0];
			await moveFor(key, Math.hypot(target.x, target.z) < 2 ? 90 : 180);
		}
	};

	// Lock-on plus camera-relative pursuit keeps combat deterministic even when
	// the ranged archetype retreats from the player.
	await engageEnemies(6);
	await expect(game).toHaveAttribute("data-action3d-enemies", "0", {
		timeout: 8_000,
	});
	await navigateTo(0, 12.5);
	await expect(game).toHaveAttribute("data-action3d-world", "aether-causeway", {
		timeout: 8_000,
	});
	await expect(page.locator("canvas.action3d-canvas")).toBeVisible();
	await engageEnemies(7);
	await expect(game).toHaveAttribute("data-action3d-phase", "victory", {
		timeout: 8_000,
	});
	await expect(page.locator("canvas.action3d-canvas")).toHaveAttribute(
		"data-action3d-defeated-settled",
		"2",
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
		schemaVersion: 2,
		phase: "victory",
		location: {
			worldId: "aether-causeway",
			checkpointId: "north-relay",
		},
	});

	await page.reload();
	await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
	await page.getByRole("button", { name: "Continue" }).click();
	await expect(game).toHaveAttribute("data-action3d-phase", "victory");
	await expect(page.locator("canvas.action3d-canvas")).toBeVisible();

	const secondContext = await browser.newContext();
	try {
		const secondPage = await secondContext.newPage();
		await loginToAction3d(secondPage);
		await expect(
			secondPage.getByRole("button", { name: "Continue" }),
		).toBeEnabled();
		await secondPage.getByRole("button", { name: "Continue" }).click();
		await expect(secondPage.locator("main.action3d-game")).toHaveAttribute(
			"data-action3d-world",
			"aether-causeway",
		);
	} finally {
		await secondContext.close();
	}
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
	await loginToAction3d(page, true);
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
	expect(requests.some((url) => /aether-causeway\.json/.test(url))).toBe(false);
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
	await loginToAction3d(page, true);
	await page.evaluate(() => {
		window.localStorage.setItem(
			"action-3d:checkpoint:admin%40example.com",
			"{corrupt",
		);
	});
	await page.reload();
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
		await page.waitForTimeout(2_000);
		const cdp = await context.newCDPSession(page);
		await cdp.send("Performance.enable");
		// Compile shaders and settle instrumentation before collecting a steady-play
		// window. A pre-sample collection keeps browser GC scheduling outside the
		// measured window while allocation churn can still trigger GC during it.
		await warmAnimationFrames(page, 210);
		await cdp.send("HeapProfiler.collectGarbage");
		const desktop = await measureAnimationFrames(page, 3, 90);

		await page.setViewportSize({ width: 390, height: 844 });
		await warmAnimationFrames(page, 180);
		await cdp.send("HeapProfiler.collectGarbage");
		const compact = await measureAnimationFrames(page, 3, 60);
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
		const cdpMetrics = await cdp.send("Performance.getMetrics");
		const metric = (name: string) =>
			cdpMetrics.metrics.find((item) => item.name === name)?.value ?? null;
		const memory = {
			jsHeapUsedBytes: metric("JSHeapUsedSize"),
			jsHeapTotalBytes: metric("JSHeapTotalSize"),
			domNodes: metric("Nodes"),
		};
		expect(Number(runtime.drawCalls)).toBeLessThanOrEqual(60);
		expect(Number(runtime.activeMeshes)).toBeLessThanOrEqual(100);
		expect(
			runtime.resources.filter((resource) => resource.name === "aether-runner.glb"),
		).toHaveLength(1);
		expect(
			runtime.resources.filter((resource) => resource.name === "aether-sentinel.glb"),
		).toHaveLength(1);
		await testInfo.attach("action3d-performance.json", {
			body: Buffer.from(
				JSON.stringify({ desktop, compact, runtime, memory }, null, 2),
			),
			contentType: "application/json",
		});
		// A single headless run can be disturbed by host scheduling. Requiring a
		// majority of three independent windows preserves the steady-state budget
		// without accepting the best sample alone. At least two windows must also be
		// completely free of >50 ms long tasks.
		expect(
			desktop.summaries.filter(({ p95Ms }) => p95Ms <= 20.5).length,
		).toBeGreaterThanOrEqual(2);
		expect(
			new Set(
				desktop.longTasks
					.filter(({ duration }) => duration > 50)
					.map(({ runIndex }) => runIndex),
			).size,
		).toBeLessThanOrEqual(1);
		expect(
			compact.summaries.filter(({ p95Ms }) => p95Ms <= 33.3).length,
		).toBeGreaterThanOrEqual(2);
		expect(
			new Set(
				compact.longTasks
					.filter(({ duration }) => duration > 50)
					.map(({ runIndex }) => runIndex),
			).size,
		).toBeLessThanOrEqual(1);
	} finally {
		await isolatedBrowser.close();
	}
});
