import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
	await page.goto("/login?redirect=%2Fpages");
	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();
	await expect(page).toHaveURL(/\/pages$/);
}

async function createPage(page: Page) {
	await page.getByRole("button", { name: "新しいページ", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "無題", exact: true }),
	).toBeVisible();
}

test("creates, renames, edits and restores a page with its child", async ({
	page,
}) => {
	await signIn(page);
	await createPage(page);
	const title = `タイトル検証 ${test.info().project.name}`;
	await page.getByRole("button", { name: "タイトルを編集" }).click();
	await page.getByLabel("ページタイトル").fill(` ${title} `);
	await page.getByRole("button", { name: "タイトルを保存" }).click();
	await expect(
		page.getByRole("heading", { name: title, exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: title, exact: true }),
	).toBeVisible();
	const parentUrl = page.url();
	const bodySaved = page.waitForResponse(
		(response) =>
			response.request().method() === "PUT" &&
			response.url().endsWith("/content"),
	);
	const editor = page.getByRole("textbox", { name: "本文", exact: true });
	await editor.click();
	await editor.pressSequentially("Persisted body content");
	await expect(editor).toHaveText("Persisted body content");
	expect((await bodySaved).status()).toBe(200);
	await expect(page.getByRole("status")).toHaveText("保存済み");
	await page.getByRole("button", { name: `${title}の子ページを作成` }).click();
	await expect(
		page.getByRole("heading", { name: "無題", exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "タイトルを編集" }).click();
	await page.getByLabel("ページタイトル").fill(`${title} child`);
	await page.getByRole("button", { name: "タイトルを保存" }).click();
	await expect(
		page.getByRole("heading", { name: `${title} child`, exact: true }),
	).toBeVisible();
	await page.goto(parentUrl);
	await page.reload();
	await expect(
		page.getByRole("heading", { name: title, exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("textbox", { name: "本文", exact: true }),
	).toHaveText("Persisted body content");
	await expect(
		page.getByRole("button", { name: `${title} child`, exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "タイトルを編集" }).click();
	await page.getByLabel("ページタイトル").fill("通信失敗の下書き");
	await page.route("**/api/pages/*", async (route) => {
		if (route.request().method() === "PATCH") await route.abort();
		else await route.continue();
	});
	await page.getByRole("button", { name: "タイトルを保存" }).click();
	await expect(page.getByRole("alert")).toHaveText(
		"タイトルを保存できませんでした",
	);
	await expect(page.getByLabel("ページタイトル")).toHaveValue(
		"通信失敗の下書き",
	);
	await page.getByRole("button", { name: "キャンセル" }).click();
});

test("keeps slash commands temporary and formats every selected block", async ({
	page,
}) => {
	await signIn(page);
	await createPage(page);
	const editor = page.getByRole("textbox", { name: "本文", exact: true });
	const savedValues: unknown[] = [];
	await page.route("**/api/pages/*/content", async (route) => {
		if (route.request().method() === "PUT") {
			const payload = JSON.parse(route.request().postData() ?? "{}") as {
				value?: unknown;
			};
			savedValues.push(payload.value);
		}
		await route.continue();
	});

	await editor.click();
	await editor.pressSequentially("/");
	const search = page.getByRole("textbox", { name: "ブロックを検索" });
	await expect(search).toBeFocused();
	await search.fill("h2");
	await search.press("Enter");
	await editor.pressSequentially("見出しテキスト");
	await editor.press("Enter");
	await editor.pressSequentially("段落テキスト");
	await editor.evaluate((element) => {
		const range = document.createRange();
		const strings = element.querySelectorAll("[data-slate-string]");
		const first = strings[0]?.firstChild;
		const last = strings[strings.length - 1]?.firstChild;
		if (!first || !last) throw new Error("Selection text nodes missing");
		range.setStart(first, 0);
		range.setEnd(last, last.textContent?.length ?? 0);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
		document.dispatchEvent(new Event("selectionchange"));
	});
	await expect
		.poll(() => editor.evaluate(() => window.getSelection()?.toString()))
		.toContain("見出しテキスト");
	await expect
		.poll(() => editor.evaluate(() => window.getSelection()?.toString()))
		.toContain("段落テキスト");
	await page.getByRole("button", { name: "見出し1" }).click();
	await expect(editor.locator("h1")).toHaveCount(2);
	await expect(editor).toContainText("見出しテキスト");
	await expect(editor).toContainText("段落テキスト");
	await expect(page.getByRole("status")).toHaveText("保存済み");
	await page.reload();
	await expect(
		page.getByRole("textbox", { name: "本文", exact: true }),
	).toContainText("見出しテキスト");
	await expect(
		page.getByRole("textbox", { name: "本文", exact: true }).locator("h1"),
	).toHaveCount(2);
	expect(JSON.stringify(savedValues.at(-1))).not.toContain("slash_input");
});

test("keeps editing during a held save and traps focus in the leave dialog", async ({
	page,
}) => {
	await signIn(page);
	await createPage(page);
	let releaseFirst!: () => void;
	let markFirstStarted!: () => void;
	const firstStarted = new Promise<void>((resolve) => {
		markFirstStarted = resolve;
	});
	const firstGate = new Promise<void>((resolve) => {
		releaseFirst = resolve;
	});
	let held = false;
	await page.route("**/api/pages/*/content", async (route) => {
		if (route.request().method() === "PUT" && !held) {
			held = true;
			markFirstStarted();
			await firstGate;
		}
		await route.continue();
	});

	const editor = page.getByRole("textbox", { name: "本文", exact: true });
	await editor.click();
	await page.keyboard.insertText("最初の本文");
	await page.getByRole("button", { name: "保存", exact: true }).click();
	await firstStarted;
	await expect(editor).toHaveAttribute("contenteditable", "true");
	await editor.click();
	await editor.press("ControlOrMeta+End");
	await page.keyboard.insertText(" 続き");
	await expect(page.getByRole("button", { name: "Logout" })).toBeDisabled();
	await page.getByRole("link", { name: "Home" }).click();
	await expect(page.getByText("保存が終わるまで移動できません")).toBeVisible();
	await expect(page).toHaveURL(/\/pages\//);

	releaseFirst();
	await expect(page.getByRole("status")).toHaveText("保存済み", {
		timeout: 10_000,
	});
	await expect(editor).toContainText("最初の本文 続き");
	await editor.click();
	await editor.press("ControlOrMeta+End");
	await page.route("**/api/pages/*/content", async (route) => {
		if (route.request().method() === "PUT") await route.abort();
		else await route.continue();
	});
	await page.keyboard.insertText(" 未保存");
	await expect(editor).toContainText(" 未保存");
	await expect(page.getByRole("status")).toHaveText("保存できませんでした");
	await page.getByRole("link", { name: "Home" }).click();
	const dialog = page.getByRole("alertdialog");
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole("button", { name: "戻る" })).toBeFocused();
	await page.keyboard.press("Shift+Tab");
	await expect(
		dialog.getByRole("button", { name: "破棄して移動" }),
	).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(dialog.getByRole("button", { name: "戻る" })).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(dialog).not.toBeVisible();
	await expect(page).toHaveURL(/\/pages\//);
});
