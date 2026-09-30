import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

it("exposes owned page APIs and rolls back failed content inserts", () => {
	const directory = mkdtempSync(path.join(tmpdir(), "hono-pages-api-"));
	try {
		const result = spawnSync(
			"bun",
			[
				"-e",
				`
import assert from "node:assert/strict";
import { Database } from "bun:sqlite";
import { eq, sql } from "drizzle-orm";
import { EMPTY_PAGE_VALUE } from "./shared/schemas/pages.schema.ts";
import { runSqliteMigrations } from "./api/db/migrate-sqlite.ts";
import { pages } from "./api/db/schema.ts";
import { AuthService } from "./api/modules/auth/auth.service.ts";

const origin = "http://localhost:5173";
const jsonHeaders = {
	"Content-Type": "application/json",
	Origin: origin,
};

await runSqliteMigrations({ databaseUrl: process.env.DATABASE_URL });

const { default: app, getAppRuntime } = await import("./api/app/hono.ts");
const runtime = await getAppRuntime();
const authService = new AuthService(runtime.dbRuntime.client, runtime.env);

const userA = await authService.createAdmin({
	email: "pages-a@example.com",
	displayName: "User A",
	password: "password123456",
});
const userB = await authService.createAdmin({
	email: "pages-b@example.com",
	displayName: "User B",
	password: "password123456",
});

async function login(email) {
	const response = await app.request("http://localhost:5173/api/auth/login", {
		method: "POST",
		headers: jsonHeaders,
		body: JSON.stringify({ email, password: "password123456" }),
	});
	assert.equal(response.status, 200);
	return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
}

function authHeaders(cookies) {
	return { ...jsonHeaders, Cookie: cookies };
}

function count(table) {
	const db = new Database(process.env.DATABASE_URL, { readonly: true });
	try {
		return db.query("SELECT COUNT(*) AS n FROM " + table).get().n;
	} finally {
		db.close();
	}
}

const cookiesA = await login("pages-a@example.com");
const cookiesB = await login("pages-b@example.com");

const unauthenticated = [
	["POST", "/api/pages", JSON.stringify({ title: "無題" })],
	["GET", "/api/pages", undefined],
	["GET", "/api/pages/" + userA.id, undefined],
	["PATCH", "/api/pages/" + userA.id, JSON.stringify({ title: "改名" })],
	["POST", "/api/pages/" + userA.id + "/move", JSON.stringify({ parentId: null, expectedParentId: null })],
	["PUT", "/api/pages/" + userA.id + "/content", JSON.stringify({ revision: 0, value: [{ type: "p", children: [{ text: "" }] }] })],
];
const pagesBeforeUnauth = count("pages");
const contentsBeforeUnauth = count("page_contents");
for (const [method, url, body] of unauthenticated) {
	const response = await app.request(url, {
		method,
		headers: body ? jsonHeaders : { Origin: origin },
		body,
	});
	assert.equal(response.status, 401, method + " " + url + " " + await response.text());
}
assert.equal(count("pages"), pagesBeforeUnauth);
assert.equal(count("page_contents"), contentsBeforeUnauth);

const createRoot = await app.request("/api/pages", {
	method: "POST",
	headers: authHeaders(cookiesA),
	body: JSON.stringify({ title: "無題", parentId: null }),
});
assert.equal(createRoot.status, 201);
const rootBody = await createRoot.json();
assert.equal(rootBody.page.parentId, null);
assert.equal(rootBody.page.ownerId, userA.id);
assert.equal(rootBody.page.title, "無題");
assert.equal(count("page_contents"), 1);
assert.equal(count("pages"), 1);

const createChild = await app.request("/api/pages", {
	method: "POST",
	headers: authHeaders(cookiesA),
	body: JSON.stringify({ title: "子ページ", parentId: rootBody.page.id }),
});
assert.equal(createChild.status, 201);
const childBody = await createChild.json();
assert.equal(childBody.page.parentId, rootBody.page.id);

const listed = await app.request("/api/pages", { headers: authHeaders(cookiesA) });
assert.equal(listed.status, 200);
const listedBody = await listed.json();
assert.equal(listedBody.pages.length, 2);
assert.equal(listedBody.pages.some((page) => page.title === "無題"), true);
assert.equal(listedBody.pages.some((page) => page.title === "子ページ"), true);
for (let index = 1; index < listedBody.pages.length; index++) {
	const previous = listedBody.pages[index - 1];
	const current = listedBody.pages[index];
	assert.ok(
		previous.createdAt < current.createdAt ||
			(previous.createdAt === current.createdAt && previous.id <= current.id),
	);
}
assert.equal("ownerId" in listedBody.pages[0], false);

const detail = await app.request("/api/pages/" + childBody.page.id, {
	headers: authHeaders(cookiesA),
});
assert.equal(detail.status, 200);
const detailBody = await detail.json();
assert.equal(detailBody.page.parentId, rootBody.page.id);
assert.equal(detailBody.content.revision, 0);
assert.deepEqual(detailBody.content.value, EMPTY_PAGE_VALUE);

const renamed = await app.request("/api/pages/" + rootBody.page.id, {
	method: "PATCH",
	headers: authHeaders(cookiesA),
	body: JSON.stringify({ title: "新しいタイトル" }),
});
assert.equal(renamed.status, 200);
const renamedList = await (await app.request("/api/pages", { headers: authHeaders(cookiesA) })).json();
assert.equal(renamedList.pages.find((page) => page.id === rootBody.page.id).title, "新しいタイトル");
const renamedDetail = await (await app.request("/api/pages/" + rootBody.page.id, { headers: authHeaders(cookiesA) })).json();
assert.equal(renamedDetail.page.title, "新しいタイトル");

const bGetsA = await app.request("/api/pages/" + rootBody.page.id, {
	headers: authHeaders(cookiesB),
});
assert.equal(bGetsA.status, 404);
assert.deepEqual(JSON.parse(await bGetsA.text()), { message: "Not found" });
const bPatchesA = await app.request("/api/pages/" + rootBody.page.id, {
	method: "PATCH",
	headers: authHeaders(cookiesB),
	body: JSON.stringify({ title: "乗っ取った" }),
});
assert.equal(bPatchesA.status, 404);
const stillA = await (await app.request("/api/pages/" + rootBody.page.id, { headers: authHeaders(cookiesA) })).json();
assert.equal(stillA.page.title, "新しいタイトル");

const pagesBeforeSteal = count("pages");
const contentsBeforeSteal = count("page_contents");
const bUsesAParent = await app.request("/api/pages", {
	method: "POST",
	headers: authHeaders(cookiesB),
	body: JSON.stringify({ title: "盗み見", parentId: rootBody.page.id }),
});
assert.equal(bUsesAParent.status, 404);
assert.equal(count("pages"), pagesBeforeSteal);
assert.equal(count("page_contents"), contentsBeforeSteal);

const createB = await app.request("/api/pages", {
	method: "POST",
	headers: authHeaders(cookiesB),
	body: JSON.stringify({ title: "Bのページ" }),
});
assert.equal(createB.status, 201);
const listB = await (await app.request("/api/pages", { headers: authHeaders(cookiesB) })).json();
assert.deepEqual(listB.pages.map((page) => page.title), ["Bのページ"]);
const listA = await (await app.request("/api/pages", { headers: authHeaders(cookiesA) })).json();
assert.equal(listA.pages.some((page) => page.title === "Bのページ"), false);

const createGrandchild = await app.request("/api/pages", {
	method: "POST",
	headers: authHeaders(cookiesA),
	body: JSON.stringify({ title: "孫ページ", parentId: childBody.page.id }),
});
assert.equal(createGrandchild.status, 201);
const grandchild = (await createGrandchild.json()).page;
const createMoveTarget = await app.request("/api/pages", {
	method: "POST",
	headers: authHeaders(cookiesA),
	body: JSON.stringify({ title: "移動先" }),
});
assert.equal(createMoveTarget.status, 201);
const moveTargetId = (await createMoveTarget.json()).page.id;
const moveHeaders = authHeaders(cookiesA);
async function move(pageId, parentId, expectedParentId) {
	return app.request("/api/pages/" + pageId + "/move", {
		method: "POST",
		headers: moveHeaders,
		body: JSON.stringify({ parentId, expectedParentId }),
	});
}
function moveSnapshot(ids) {
	const db = new Database(process.env.DATABASE_URL, { readonly: true });
	try {
		return ids.map((id) => ({
			page: db.query("SELECT id, parent_id, owner_id, title, created_at, updated_at FROM pages WHERE id = ?").get(id),
			content: db.query("SELECT page_id, value_json, revision, updated_at FROM page_contents WHERE page_id = ?").get(id),
		}));
	} finally { db.close(); }
}
const subtreeIds = [rootBody.page.id, childBody.page.id, grandchild.id];
const beforeMove = moveSnapshot(subtreeIds);
const moved = await move(rootBody.page.id, moveTargetId, null);
assert.equal(moved.status, 200, await moved.clone().text());
const movedBody = await moved.json();
assert.equal(movedBody.page.parentId, moveTargetId);
const afterMove = moveSnapshot(subtreeIds);
assert.equal(afterMove[0].page.parent_id, moveTargetId);
assert.equal(afterMove[1].page.parent_id, rootBody.page.id);
assert.equal(afterMove[2].page.parent_id, childBody.page.id);
assert.deepEqual(afterMove.map((row) => row.content), beforeMove.map((row) => row.content));
assert.equal(afterMove[0].page.title, beforeMove[0].page.title);
assert.equal(afterMove[1].page.updated_at, beforeMove[1].page.updated_at);
assert.equal(afterMove[2].page.updated_at, beforeMove[2].page.updated_at);

const sameParentBefore = moveSnapshot([rootBody.page.id])[0].page.updated_at;
const noOpMove = await move(rootBody.page.id, moveTargetId, moveTargetId);
assert.equal(noOpMove.status, 200);
assert.equal(moveSnapshot([rootBody.page.id])[0].page.updated_at, sameParentBefore);

for (const invalidTarget of [rootBody.page.id, childBody.page.id, grandchild.id]) {
	const rejected = await move(rootBody.page.id, invalidTarget, moveTargetId);
	assert.equal(rejected.status, 409);
	assert.deepEqual(await rejected.json(), {
		message: "Invalid page hierarchy",
		code: "INVALID_PAGE_HIERARCHY",
	});
}
const staleParent = await move(rootBody.page.id, null, null);
assert.equal(staleParent.status, 409);
assert.deepEqual(await staleParent.json(), {
	message: "Page parent conflict",
	code: "PAGE_PARENT_CONFLICT",
	currentParentId: moveTargetId,
});
const wrongOwnerMove = await app.request("/api/pages/" + rootBody.page.id + "/move", {
	method: "POST",
	headers: authHeaders(cookiesB),
	body: JSON.stringify({ parentId: null, expectedParentId: moveTargetId }),
});
assert.equal(wrongOwnerMove.status, 404);
const invalidMove = await app.request("/api/pages/" + rootBody.page.id + "/move", {
	method: "POST",
	headers: moveHeaders,
	body: JSON.stringify({ parentId: null, expectedParentId: moveTargetId, title: "ignored" }),
});
assert.equal(invalidMove.status, 400);
const backAtRoot = await move(rootBody.page.id, null, moveTargetId);
assert.equal(backAtRoot.status, 200);
const concurrent = await Promise.all([
	move(rootBody.page.id, moveTargetId, null),
	move(moveTargetId, rootBody.page.id, null),
]);
assert.equal(concurrent.filter((response) => response.status === 200).length, 1);
assert.equal(concurrent.filter((response) => response.status === 409).length, 1);
const concurrentPages = await (await app.request("/api/pages", { headers: moveHeaders })).json();
const parentById = new Map(concurrentPages.pages.map((page) => [page.id, page.parentId]));
for (const page of concurrentPages.pages) {
	const visited = new Set([page.id]);
	let parentId = page.parentId;
	while (parentId !== null) {
		assert.equal(visited.has(parentId), false);
		visited.add(parentId);
		parentId = parentById.get(parentId) ?? null;
	}
}
const childReparent = await move(childBody.page.id, null, rootBody.page.id);
assert.equal(childReparent.status, 200);
const movedChild = await (await app.request("/api/pages/" + childBody.page.id, { headers: moveHeaders })).json();
assert.equal(movedChild.page.parentId, null);
assert.equal(movedChild.content.revision, 0);

const corruptOne = (await (await app.request("/api/pages", {
	method: "POST", headers: moveHeaders, body: JSON.stringify({ title: "破損1" }),
})).json()).page;
const corruptTwo = (await (await app.request("/api/pages", {
	method: "POST", headers: moveHeaders, body: JSON.stringify({ title: "破損2" }),
})).json()).page;
await runtime.dbRuntime.client.write.execute((db) => {
	db.update(pages).set({ parentId: corruptTwo.id }).where(eq(pages.id, corruptOne.id)).run();
	db.update(pages).set({ parentId: corruptOne.id }).where(eq(pages.id, corruptTwo.id)).run();
});
const corruptBefore = moveSnapshot([childBody.page.id, corruptOne.id, corruptTwo.id]);
const brokenAncestor = await move(childBody.page.id, corruptOne.id, null);
assert.equal(brokenAncestor.status, 500);
assert.deepEqual(moveSnapshot([childBody.page.id, corruptOne.id, corruptTwo.id]), corruptBefore);
const brokenCurrentChain = await move(corruptOne.id, null, corruptTwo.id);
assert.equal(brokenCurrentChain.status, 500);
assert.deepEqual(moveSnapshot([childBody.page.id, corruptOne.id, corruptTwo.id]), corruptBefore);
await runtime.dbRuntime.client.write.execute((db) => {
	db.update(pages).set({ parentId: null }).where(eq(pages.id, corruptOne.id)).run();
	db.update(pages).set({ parentId: null }).where(eq(pages.id, corruptTwo.id)).run();
});

await runtime.dbRuntime.client.write.execute((db) => {
	db.run(sql.raw("CREATE TRIGGER fail_page_move BEFORE UPDATE OF parent_id ON pages WHEN OLD.id = '" + childBody.page.id + "' BEGIN SELECT RAISE(ABORT, 'forced move failure'); END"));
});
const beforeFailedMove = moveSnapshot([childBody.page.id]);
const failedMove = await move(childBody.page.id, corruptOne.id, null);
assert.equal(failedMove.status, 500);
assert.deepEqual(moveSnapshot([childBody.page.id]), beforeFailedMove);
await runtime.dbRuntime.client.write.execute((db) => {
	db.run(sql.raw("DROP TRIGGER fail_page_move"));
});

const deletedCreate = await app.request("/api/pages", {
	method: "POST",
	headers: authHeaders(cookiesA),
	body: JSON.stringify({ title: "削除済み" }),
});
assert.equal(deletedCreate.status, 201);
const deletedId = (await deletedCreate.json()).page.id;
await runtime.dbRuntime.client.write.execute((db) =>
	db.update(pages).set({ deletedAt: new Date() }).where(eq(pages.id, deletedId)).run(),
);
const afterDeleteList = await (await app.request("/api/pages", { headers: authHeaders(cookiesA) })).json();
assert.equal(afterDeleteList.pages.some((page) => page.id === deletedId), false);
const deletedGet = await app.request("/api/pages/" + deletedId, { headers: authHeaders(cookiesA) });
assert.equal(deletedGet.status, 404);
assert.deepEqual(JSON.parse(await deletedGet.text()), { message: "Not found" });
const childOfDeleted = await app.request("/api/pages", {
	method: "POST",
	headers: authHeaders(cookiesA),
	body: JSON.stringify({ title: "子", parentId: deletedId }),
});
assert.equal(childOfDeleted.status, 404);

const pagesBeforeInvalid = count("pages");
const blankTitle = await app.request("/api/pages", {
	method: "POST",
	headers: authHeaders(cookiesA),
	body: JSON.stringify({ title: "   " }),
});
assert.equal(blankTitle.status, 400);
assert.deepEqual(JSON.parse(await blankTitle.text()), { message: "Invalid request" });
const unknownKey = await app.request("/api/pages", {
	method: "POST",
	headers: authHeaders(cookiesA),
	body: JSON.stringify({ title: "無題", ownerId: userB.id }),
});
assert.equal(unknownKey.status, 400);
assert.deepEqual(JSON.parse(await unknownKey.text()), { message: "Invalid request" });
const patchExtra = await app.request("/api/pages/" + rootBody.page.id, {
	method: "PATCH",
	headers: authHeaders(cookiesA),
	body: JSON.stringify({ title: "追加キー", parentId: null }),
});
assert.equal(patchExtra.status, 400);
assert.deepEqual(JSON.parse(await patchExtra.text()), { message: "Invalid request" });
const badId = await app.request("/api/pages/not-a-uuid", {
	headers: authHeaders(cookiesA),
});
assert.equal(badId.status, 400);
assert.deepEqual(JSON.parse(await badId.text()), { message: "Invalid request" });
assert.equal(count("pages"), pagesBeforeInvalid);

await runtime.dbRuntime.client.write.execute((db) => {
	db.run(sql.raw("CREATE TRIGGER fail_page_contents BEFORE INSERT ON page_contents BEGIN SELECT RAISE(ABORT, 'forced content failure'); END"));
});
const pagesBeforeFail = count("pages");
const contentsBeforeFail = count("page_contents");
const failedCreate = await app.request("/api/pages", {
	method: "POST",
	headers: authHeaders(cookiesA),
	body: JSON.stringify({ title: "失敗するページ" }),
});
assert.equal(failedCreate.status, 500);
assert.equal(count("pages"), pagesBeforeFail);
assert.equal(count("page_contents"), contentsBeforeFail);
await runtime.dbRuntime.client.write.execute((db) => {
	db.run(sql.raw("DROP TRIGGER fail_page_contents"));
});

const fk = new Database(process.env.DATABASE_URL, { readonly: true });
assert.deepEqual(fk.query("PRAGMA foreign_key_check").all(), []);
fk.close();
await runtime.dbRuntime.close();
`,
			],
			{
				encoding: "utf8",
				cwd: process.cwd(),
				env: {
					...process.env,
					NODE_ENV: "test",
					DATABASE_URL: path.join(directory, "pages.sqlite"),
					JWT_SECRET: "hono-pages-api-test-secret-32-chars",
					APP_URL: "http://localhost:5173",
					CORS_ORIGINS: "http://localhost:5173",
					AUTH_COOKIE_SECURE: "false",
				},
				timeout: 20_000,
			},
		);
		expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}, 25_000);

it("saves page content with revision checks and leaves the database unchanged on failure", () => {
	const directory = mkdtempSync(path.join(tmpdir(), "hono-page-content-"));
	try {
		const result = spawnSync(
			"bun",
			[
				"-e",
				`
import assert from "node:assert/strict";
import { Database } from "bun:sqlite";
import { eq, sql } from "drizzle-orm";
import { runSqliteMigrations } from "./api/db/migrate-sqlite.ts";
import { pages } from "./api/db/schema.ts";
import { AuthService } from "./api/modules/auth/auth.service.ts";

const origin = "http://localhost:5173";
const jsonHeaders = { "Content-Type": "application/json", Origin: origin };
await runSqliteMigrations({ databaseUrl: process.env.DATABASE_URL });
const { default: app, getAppRuntime } = await import("./api/app/hono.ts");
const runtime = await getAppRuntime();

try {
	const authService = new AuthService(runtime.dbRuntime.client, runtime.env);
	const userA = await authService.createAdmin({
		email: "content-a@example.com",
		displayName: "User A",
		password: "password123456",
	});
	await authService.createAdmin({
		email: "content-b@example.com",
		displayName: "User B",
		password: "password123456",
	});

	async function login(email) {
		const response = await app.request("/api/auth/login", {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify({ email, password: "password123456" }),
		});
		assert.equal(response.status, 200, await response.text());
		return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
	}
	function authHeaders(cookies) {
		return { ...jsonHeaders, Cookie: cookies };
	}
	function readRows(pageId) {
		const db = new Database(process.env.DATABASE_URL, { readonly: true });
		try {
			return {
				page: db.query("SELECT title, updated_at FROM pages WHERE id = ?").get(pageId),
				content: db.query("SELECT value_json, revision FROM page_contents WHERE page_id = ?").get(pageId),
			};
		} finally {
			db.close();
		}
	}
	async function putContent(cookies, pageId, body) {
		const response = await app.request("/api/pages/" + pageId + "/content", {
			method: "PUT",
			headers: cookies ? authHeaders(cookies) : jsonHeaders,
			body: JSON.stringify(body),
		});
		const text = await response.text();
		return { status: response.status, text, json: text ? JSON.parse(text) : null, headers: response.headers };
	}

	const cookiesA = await login("content-a@example.com");
	const cookiesB = await login("content-b@example.com");
	const created = await app.request("/api/pages", {
		method: "POST",
		headers: authHeaders(cookiesA),
		body: JSON.stringify({ title: "本文" }),
	});
	const createdText = await created.text();
	assert.equal(created.status, 201, createdText);
	const pageId = JSON.parse(createdText).page.id;
	const beforeSave = readRows(pageId);
	const beforeDetail = await (await app.request("/api/pages/" + pageId, { headers: authHeaders(cookiesA) })).json();
	const firstValue = [{ type: "p", children: [{ text: "hello" }], id: "HvaUDqChnK" }];

	const first = await putContent(cookiesA, pageId, { revision: 0, value: firstValue });
	assert.equal(first.status, 200, first.text);
		const afterFirst = await (await app.request("/api/pages/" + pageId, { headers: authHeaders(cookiesA) })).json();
	assert.deepEqual(afterFirst.content, { revision: 1, value: firstValue });
	assert.equal(afterFirst.page.title, "本文");
	assert.deepEqual(first.json, { content: { revision: 1, value: firstValue }, page: { id: pageId, updatedAt: afterFirst.page.updatedAt } });
	const afterFirstRows = readRows(pageId);
	assert.ok(afterFirstRows.page.updated_at > beforeSave.page.updated_at);
	assert.ok(Date.parse(afterFirst.page.updatedAt) > Date.parse(beforeDetail.page.updatedAt));
	const listedAfterFirst = await (await app.request("/api/pages", { headers: authHeaders(cookiesA) })).json();
	const listedPage = listedAfterFirst.pages.find((page) => page.id === pageId);
	assert.ok(listedPage);
	assert.equal(listedPage.updatedAt, afterFirst.page.updatedAt);
	assert.ok(Date.parse(listedPage.updatedAt) > Date.parse(beforeDetail.page.updatedAt));

	const secondValue = [{ type: "h1", children: [{ text: "hello" }], id: "HvaUDqChnK" }];
	const second = await putContent(cookiesA, pageId, { revision: 1, value: secondValue });
	assert.equal(second.status, 200, second.text);
	const afterSecond = await (await app.request("/api/pages/" + pageId, { headers: authHeaders(cookiesA) })).json();
	assert.deepEqual(second.json, { content: { revision: 2, value: secondValue }, page: { id: pageId, updatedAt: afterSecond.page.updatedAt } });
	const afterSecondRows = readRows(pageId);
	assert.ok(afterSecondRows.page.updated_at > afterFirstRows.page.updated_at);

	const beforeConflict = readRows(pageId);
	const conflict = await putContent(cookiesA, pageId, { revision: 0, value: firstValue });
	assert.equal(conflict.status, 409, conflict.text);
	assert.deepEqual(conflict.json, {
		message: "Content revision conflict",
		currentRevision: 2,
	});
	assert.deepEqual(readRows(pageId), beforeConflict);

	const stolen = await putContent(cookiesB, pageId, { revision: 2, value: firstValue });
	assert.equal(stolen.status, 404, stolen.text);
	assert.deepEqual(stolen.json, { message: "Not found" });
	assert.deepEqual(readRows(pageId), beforeConflict);

	const anonymous = await app.request("/api/pages/" + pageId + "/content", {
		method: "PUT",
		headers: { "Content-Type": "application/json", Origin: origin },
		body: JSON.stringify({ revision: 2, value: firstValue }),
	});
	const anonymousText = await anonymous.text();
	assert.equal(anonymous.status, 401, anonymousText);
	assert.deepEqual(JSON.parse(anonymousText), { message: "Unauthorized" });
	assert.deepEqual(readRows(pageId), beforeConflict);

	const invalidBodies = [
		{ revision: 2, value: [] },
		{ revision: 2, value: [{ type: "blockquote", children: [{ text: "x" }] }] },
		{ revision: 2, value: [{ type: "p", children: [{ text: "x", href: "https://example.com" }] }] },
		{ revision: 2, value: [{ type: "p", className: "x", children: [{ text: "x" }] }] },
		{ revision: 2, value: firstValue, ownerId: userA.id },
		{ revision: 2, value: Array.from({ length: 11 }, () => ({ type: "p", children: [{ text: "a".repeat(100000) }] })) },
	];
	for (const body of invalidBodies) {
		const response = await putContent(cookiesA, pageId, body);
		assert.equal(response.status, 400, response.text);
		assert.deepEqual(response.json, { message: "Invalid request" });
	}
	const badId = await putContent(cookiesA, "not-a-uuid", { revision: 2, value: firstValue });
	assert.equal(badId.status, 400, badId.text);
	assert.deepEqual(badId.json, { message: "Invalid request" });
	assert.deepEqual(readRows(pageId), beforeConflict);

	const missing = await putContent(cookiesA, userA.id, { revision: 0, value: firstValue });
	assert.equal(missing.status, 404, missing.text);
	assert.deepEqual(missing.json, { message: "Not found" });

	const deleted = await app.request("/api/pages", {
		method: "POST",
		headers: authHeaders(cookiesA),
		body: JSON.stringify({ title: "削除済み" }),
	});
	const deletedText = await deleted.text();
	assert.equal(deleted.status, 201, deletedText);
	const deletedId = JSON.parse(deletedText).page.id;
	const beforeDelete = readRows(deletedId);
	await runtime.dbRuntime.client.write.execute((db) =>
		db.update(pages).set({ deletedAt: new Date() }).where(eq(pages.id, deletedId)).run(),
	);
	const deletedSave = await putContent(cookiesA, deletedId, { revision: 0, value: firstValue });
	assert.equal(deletedSave.status, 404, deletedSave.text);
	assert.deepEqual(readRows(deletedId).content, beforeDelete.content);

	await runtime.dbRuntime.client.write.execute((db) => {
		db.run(sql.raw("CREATE TRIGGER fail_page_content_update BEFORE UPDATE ON page_contents BEGIN SELECT RAISE(ABORT, 'forced content update failure'); END"));
	});
	const failed = await putContent(cookiesA, pageId, { revision: 2, value: firstValue });
	assert.equal(failed.status, 500, failed.text);
	assert.deepEqual(readRows(pageId), beforeConflict);
	await runtime.dbRuntime.client.write.execute((db) => {
		db.run(sql.raw("DROP TRIGGER fail_page_content_update"));
	});

	const preflight = await app.request("/api/pages/" + pageId + "/content", {
		method: "OPTIONS",
		headers: {
			Origin: origin,
			"Access-Control-Request-Method": "PUT",
			"Access-Control-Request-Headers": "content-type",
		},
	});
	const preflightText = await preflight.text();
	assert.equal(preflight.status, 204, preflightText);
	assert.match(preflight.headers.get("Access-Control-Allow-Methods") ?? "", /\\bPUT\\b/);
} finally {
	await runtime.dbRuntime.close();
}
`,
			],
			{
				encoding: "utf8",
				cwd: process.cwd(),
				env: {
					...process.env,
					NODE_ENV: "test",
					DATABASE_URL: path.join(directory, "content.sqlite"),
					JWT_SECRET: "hono-page-content-test-secret-32ch",
					APP_URL: "http://localhost:5173",
					CORS_ORIGINS: "http://localhost:5173",
					AUTH_COOKIE_SECURE: "false",
				},
				timeout: 30_000,
			},
		);
		expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}, 40_000);
