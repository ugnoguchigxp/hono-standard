import { expect, test } from "@playwright/test";

test("duplicates a saved page and edits the copy independently", async ({
	page,
}) => {
	await page.goto("/login?redirect=%2Fpages");
	await page.getByLabel("Email").fill("admin@example.com");
	await page.getByLabel("Password").fill("password123456");
	await page.getByRole("button", { name: /ログイン/ }).click();
	await expect(page).toHaveURL(/\/pages$/);
	await page.getByRole("button", { name: "新しいページ", exact: true }).click();
	await page.getByRole("button", { name: "タイトルを編集" }).click();
	await page.getByLabel("ページタイトル").fill("複製元");
	await page.getByRole("button", { name: "タイトルを保存" }).click();
	await expect(
		page.getByRole("heading", { name: "複製元", exact: true }),
	).toBeVisible();
	const sourceUrl = page.url();
	const editor = page.getByRole("textbox", { name: "本文", exact: true });
	await editor.click();
	const sourceSave = page.waitForResponse(
		(response) =>
			response.request().method() === "PUT" &&
			response.url().endsWith("/content"),
	);
	await editor.pressSequentially("Saved source body");
	await expect(editor).toHaveText("Saved source body");
	expect((await sourceSave).status()).toBe(200);
	await expect(page.getByRole("status")).toHaveText("保存済み");

	await page.getByRole("button", { name: "ページを複製", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "「複製元」を複製しますか" });
	await expect(dialog).toBeVisible();
	await expect(
		dialog.getByText(
			"このページのタイトルと保存済み本文を複製します。子ページは含みません。",
		),
	).toBeVisible();
	const duplicateResponse = page.waitForResponse(
		(response) =>
			response.request().method() === "POST" &&
			response.url().endsWith("/duplicate"),
	);
	await dialog.getByRole("button", { name: "複製する" }).click();
	expect((await duplicateResponse).status()).toBe(201);
	await expect(page).not.toHaveURL(sourceUrl);
	await expect(page).toHaveURL(/\/pages\/[0-9a-f-]+$/);
	const duplicateUrl = page.url();
	await expect(
		page.getByRole("heading", { name: "複製元 のコピー", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("textbox", { name: "本文", exact: true }),
	).toHaveText("Saved source body");

	const duplicateEditor = page.getByRole("textbox", {
		name: "本文",
		exact: true,
	});
	await duplicateEditor.click();
	await duplicateEditor.press("ControlOrMeta+End");
	await duplicateEditor.pressSequentially(" copy only edit");
	await expect(duplicateEditor).toHaveText("Saved source body copy only edit");
	await expect(page.getByRole("status")).toHaveText("未保存");
	const duplicateSave = page.waitForResponse(
		(response) =>
			response.request().method() === "PUT" &&
			response.url().endsWith("/content") &&
			response.request().postData()?.includes("copy only edit") === true,
	);
	if (!test.info().project.name.startsWith("mobile")) {
		await page.getByRole("button", { name: "保存", exact: true }).click();
	}
	const saveResponse = await duplicateSave;
	expect(saveResponse.status()).toBe(200);
	const savedBody = await saveResponse.json();
	expect(savedBody.content.revision).toBe(1);
	expect(savedBody.content.value[0].children[0].text).toBe(
		"Saved source body copy only edit",
	);
	await expect(page.getByRole("status")).toHaveText("保存済み");
	await page.goto(sourceUrl);
	await page.reload();
	await expect(
		page.getByRole("textbox", { name: "本文", exact: true }),
	).toHaveText("Saved source body");
	await page.goto(duplicateUrl);
	const duplicateId = duplicateUrl.split("/").at(-1);
	const duplicateDetailResponse = page.waitForResponse(
		(response) =>
			response.request().method() === "GET" &&
			response.url().endsWith(`/api/pages/${duplicateId}`),
	);
	const detailBodyPromise = duplicateDetailResponse.then((response) =>
		response.json(),
	);
	await page.reload();
	const detailBody = await detailBodyPromise;
	expect(detailBody.content.value[0].children[0].text).toBe(
		"Saved source body copy only edit",
	);
	await expect(
		page.getByRole("textbox", { name: "本文", exact: true }),
	).toHaveText("Saved source body copy only edit");
});
