import { expect, type Page } from "@playwright/test";

export const fixedDashboardSearch = () => ({
	range: "1h",
	timezone: "UTC",
	refresh: 0,
	filters: {},
});

export async function loginAsDemoAdmin(page: Page, redirect: string) {
	await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`);
	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();
	await expect.poll(() => new URL(page.url()).pathname).toBe(redirect);
}

export async function openDashboard(
	page: Page,
	options: { gallery?: boolean } = {},
) {
	const route = options.gallery ? "/dashboard/gallery" : "/dashboard";
	await loginAsDemoAdmin(page, route);
}

export async function waitForDashboardReady(page: Page) {
	await expect(page.locator("[data-dashboard-ready='true']")).toBeVisible();
	await expect.poll(() => page.getByRole("article").count()).toBeGreaterThan(0);
}

export async function waitForDashboardVisualReady(page: Page) {
	await waitForDashboardReady(page);
	const articles = page.getByRole("article");
	await expect.poll(() => articles.count()).toBeGreaterThan(0);
	for (let index = 0; index < (await articles.count()); index += 1)
		await articles.nth(index).scrollIntoViewIfNeeded();
	await page.evaluate(() => window.scrollTo(0, 0));
	await expect
		.poll(async () =>
			page
				.getByRole("article")
				.evaluateAll((articles) =>
					articles.every(
						(article) =>
							article.getAttribute("aria-busy") !== "true" &&
							![...article.querySelectorAll(".dashboard-panel-state")].some(
								(state) => /Loading/.test(state.textContent ?? ""),
							),
					),
				),
		)
		.toBe(true);
	await page.evaluate(async () => {
		await document.fonts.ready;
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
		);
	});
	await page.waitForFunction(async () => {
		const snapshot = () =>
			JSON.stringify({
				height: document.documentElement.scrollHeight,
				boxes: [...document.querySelectorAll("article")].map((article) => {
					const box = article.getBoundingClientRect();
					return [box.x, box.y, box.width, box.height].map((value) =>
						Math.round(value),
					);
				}),
			});
		let previous = snapshot();
		let stableFrames = 0;
		for (let frame = 0; frame < 120; frame += 1) {
			await new Promise<void>((resolve) =>
				requestAnimationFrame(() => resolve()),
			);
			const next = snapshot();
			stableFrames = next === previous ? stableFrames + 1 : 0;
			if (stableFrames >= 30) return true;
			previous = next;
		}
		return false;
	});
}

export function getPanel(page: Page, accessibleName: string) {
	return page.getByRole("article", { name: accessibleName });
}

export async function readPanelBoxes(page: Page) {
	return page.getByRole("article").evaluateAll((elements) =>
		elements.map((element) => {
			const box = element.getBoundingClientRect();
			return {
				left: box.left,
				top: box.top,
				right: box.right,
				bottom: box.bottom,
				width: box.width,
				height: box.height,
			};
		}),
	);
}

export async function expectNoPanelOverlap(page: Page) {
	const boxes = await readPanelBoxes(page);
	for (let left = 0; left < boxes.length; left += 1)
		for (let right = left + 1; right < boxes.length; right += 1) {
			const first = boxes[left];
			const second = boxes[right];
			expect(
				first.left < second.right &&
					first.right > second.left &&
					first.top < second.bottom &&
					first.bottom > second.top,
			).toBe(false);
		}
}
