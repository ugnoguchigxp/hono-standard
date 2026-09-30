import { expect, test, type Page } from "@playwright/test";

async function renameSelectedPage(page: Page, title: string) {
	await page.getByRole("button", { name: "タイトルを編集" }).click();
	await page.getByLabel("ページタイトル").fill(title);
	await page.getByRole("button", { name: "タイトルを保存" }).click();
	await expect(
		page.getByRole("heading", { name: title, exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: `${title}の子ページを作成` }),
	).toBeVisible();
}

test("moves a page with descendants and keeps its selected URL after reload", async ({
	page,
}, testInfo) => {
	const suffix = testInfo.project.name;
	await page.goto("/login?redirect=%2Fpages");
	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();
	await expect(page).toHaveURL(/\/pages$/);

	await page.getByRole("button", { name: "新しいページ", exact: true }).click();
	await renameSelectedPage(page, `Move destination ${suffix}`);
	await page.getByRole("button", { name: "新しいページ", exact: true }).click();
	await renameSelectedPage(page, `Move source ${suffix}`);
	const sourceUrl = page.url();

	await page
		.getByRole("button", { name: `Move source ${suffix}の子ページを作成` })
		.click();
	await renameSelectedPage(page, `Move child ${suffix}`);
	await page
		.getByRole("button", { name: `Move child ${suffix}の子ページを作成` })
		.click();
	await renameSelectedPage(page, `Move grandchild ${suffix}`);
	await page.goto(sourceUrl);

	const movedResponse = page.waitForResponse(
		(response) =>
			response.request().method() === "POST" &&
			response.url().endsWith("/move"),
	);
	await page.getByRole("button", { name: "ページを移動", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "ページを移動" });
	await expect(dialog.getByLabel("移動先")).toBeFocused();
	await dialog
		.getByLabel("移動先")
		.selectOption({ label: `Move destination ${suffix}` });
	await dialog.getByRole("button", { name: "移動する" }).click();
	expect((await movedResponse).status()).toBe(200);
	await expect(page).toHaveURL(sourceUrl);
	await expect(
		page.getByRole("heading", { name: `Move source ${suffix}` }),
	).toBeVisible();
	await page.reload();
	await expect(
		page.getByRole("heading", { name: `Move source ${suffix}` }),
	).toBeVisible();

	const destinationRow = page
		.getByRole("button", { name: `Move destination ${suffix}` })
		.locator("xpath=ancestor::li[1]");
	await expect(
		destinationRow.getByRole("button", {
			name: `Move source ${suffix}`,
			exact: true,
		}),
	).toBeVisible();
	const sourceRow = page
		.getByRole("button", { name: `Move source ${suffix}` })
		.locator("xpath=ancestor::li[1]");
	await expect(
		sourceRow.getByRole("button", {
			name: `Move child ${suffix}`,
			exact: true,
		}),
	).toBeVisible();
	const childRow = page
		.getByRole("button", { name: `Move child ${suffix}` })
		.locator("xpath=ancestor::li[1]");
	await expect(
		childRow.getByRole("button", {
			name: `Move grandchild ${suffix}`,
			exact: true,
		}),
	).toBeVisible();
});
