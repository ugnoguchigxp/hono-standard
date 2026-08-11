import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:5174";
const output = path.resolve(
	process.cwd(),
	process.argv[3] ?? "art/action3d/reviews/a2-production-pass-after.png",
);
const captureAttack = process.argv.includes("--attack");
const captureCombo = process.argv.includes("--combo");
const captureJumpLand = process.argv.includes("--jump-land");
const captureDefeatSettle = process.argv.includes("--defeat-settle");

const outputWithSuffix = (suffix: string) => {
	const parsed = path.parse(output);
	return path.join(parsed.dir, `${parsed.name}-${suffix}${parsed.ext}`);
};

const browser = await chromium.launch();
try {
	const page = await browser.newPage({
		viewport: { width: 1280, height: 720 },
	});
	await page.goto(`${baseUrl}/games/action-3d`);
	await page.getByRole("main").getByRole("link", { name: "Login" }).click();
	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();
	await page.getByRole("button", { name: "New Game" }).click();
	const game = page.locator("main.action3d-game");
	await game.waitFor({ state: "visible" });
	await page.locator("canvas.action3d-canvas").waitFor({ state: "visible" });
	await page.waitForTimeout(900);
	await page.keyboard.down("w");
	await page.waitForTimeout(900);
	await page.keyboard.up("w");
	await page.keyboard.press("e");
	await page.waitForTimeout(800);
	await mkdir(path.dirname(output), { recursive: true });
	if (captureJumpLand) {
		await page.keyboard.press("Space");
		await page.waitForTimeout(1_200);
	}
	if (captureCombo) {
		for (let combo = 1; combo <= 3; combo += 1) {
			await page.keyboard.press("f");
			await page.waitForTimeout(240);
			await page.screenshot({
				path: outputWithSuffix(`attack-${combo}`),
				fullPage: true,
			});
			await page.waitForTimeout(360);
		}
	}
	if (captureDefeatSettle) {
		const initialEnemies = Number(
			await game.getAttribute("data-action3d-enemies"),
		);
		for (let attack = 0; attack < 8; attack += 1) {
			await page.keyboard.press("f");
			await page.waitForTimeout(600);
			if (
				Number(await game.getAttribute("data-action3d-enemies")) <
				initialEnemies
			)
				break;
		}
		await page.keyboard.press("p");
		await page.waitForTimeout(1_400);
		await page.addStyleTag({
			content: ".action3d-overlay { display: none !important; }",
		});
	}
	if (captureAttack) {
		await page.keyboard.press("f");
		await page.waitForTimeout(240);
	}
	if (!captureCombo) await page.screenshot({ path: output, fullPage: true });
	const frameRuns = await page.evaluate(async () => {
		const summaries: Array<{ medianMs: number; p95Ms: number; maxMs: number }> =
			[];
		for (let run = 0; run < 3; run += 1) {
			const values = await new Promise<number[]>((resolve) => {
				const deltas: number[] = [];
				let previous = 0;
				const frame = (now: number) => {
					if (previous) deltas.push(now - previous);
					previous = now;
					if (deltas.length >= 90) resolve(deltas);
					else requestAnimationFrame(frame);
				};
				requestAnimationFrame(frame);
			});
			const sorted = [...values].sort((left, right) => left - right);
			summaries.push({
				medianMs: sorted[Math.floor(sorted.length / 2)],
				p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
				maxMs: sorted.at(-1) ?? 0,
			});
		}
		return summaries;
	});
	const metrics = await game.evaluate((element) => ({
		fps: element.getAttribute("data-action3d-fps"),
		frameTimeMs: element.getAttribute("data-action3d-frame-ms"),
		drawCalls: element.getAttribute("data-action3d-draw-calls"),
		activeMeshes: element.getAttribute("data-action3d-active-meshes"),
		enemies: element.getAttribute("data-action3d-enemies"),
		defeatedSettled: document
			.querySelector("canvas.action3d-canvas")
			?.getAttribute("data-action3d-defeated-settled"),
		phase: element.getAttribute("data-action3d-phase"),
	}));
	console.log(`ACTION3D_RUNTIME_REVIEW ${output}`);
	console.log(JSON.stringify({ metrics, frameRuns }));
} finally {
	await browser.close();
}
