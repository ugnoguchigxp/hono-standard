import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

it("duplicates a saved page transactionally and makes retries idempotent", () => {
	const directory = mkdtempSync(path.join(tmpdir(), "hono-page-duplicate-"));
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
import { pageContents, pageDuplicateRequests, pages } from "./api/db/schema.ts";
import { AuthService } from "./api/modules/auth/auth.service.ts";
import { pageContentValueSchema } from "./shared/schemas/page-content.schema.ts";

const origin = "http://localhost:5173";
const jsonHeaders = { "Content-Type": "application/json", Origin: origin };
await runSqliteMigrations({ databaseUrl: process.env.DATABASE_URL });
const { default: app, getAppRuntime } = await import("./api/app/hono.ts");
const runtime = await getAppRuntime();
try {
	const auth = new AuthService(runtime.dbRuntime.client, runtime.env);
	const userA = await auth.createAdmin({ email: "duplicate-a@example.com", displayName: "A", password: "password123456" });
	await auth.createAdmin({ email: "duplicate-b@example.com", displayName: "B", password: "password123456" });
	async function login(email) {
		const response = await app.request("/api/auth/login", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ email, password: "password123456" }) });
		assert.equal(response.status, 200);
		return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
	}
	const cookiesA = await login("duplicate-a@example.com");
	const cookiesB = await login("duplicate-b@example.com");
	const headers = (cookies) => ({ ...jsonHeaders, Cookie: cookies });
	const count = (table) => {
		const db = new Database(process.env.DATABASE_URL, { readonly: true });
		try { return db.query("SELECT COUNT(*) AS n FROM " + table).get().n; }
		finally { db.close(); }
	};
	const parentResponse = await app.request("/api/pages", { method: "POST", headers: headers(cookiesA), body: JSON.stringify({ title: "親" }) });
	const parent = (await parentResponse.json()).page;
	const sourceResponse = await app.request("/api/pages", { method: "POST", headers: headers(cookiesA), body: JSON.stringify({ title: "会議メモ", parentId: parent.id }) });
	const source = (await sourceResponse.json()).page;
	const childResponse = await app.request("/api/pages", { method: "POST", headers: headers(cookiesA), body: JSON.stringify({ title: "子孫", parentId: source.id }) });
	assert.equal(childResponse.status, 201);
	const descendant = (await childResponse.json()).page;
	const savedValue = [
		{ type: "h1", id: "source0001", children: [{ text: "見出し", bold: true }] },
		{ type: "p", children: [{ text: "保存済み", italic: true }, { text: "本文" }] },
	];
	const saved = await app.request("/api/pages/" + source.id + "/content", { method: "PUT", headers: headers(cookiesA), body: JSON.stringify({ revision: 0, value: savedValue }) });
	assert.equal(saved.status, 200, await saved.text());
	const input = { requestId: "d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4", expectedContentRevision: 1, expectedTitle: source.title, expectedParentId: parent.id };
	const sourceBefore = await (await app.request("/api/pages/" + source.id, { headers: headers(cookiesA) })).json();
	const first = await app.request("/api/pages/" + source.id + "/duplicate", { method: "POST", headers: headers(cookiesA), body: JSON.stringify(input) });
	const firstText = await first.text();
	assert.equal(first.status, 201, firstText);
	const created = JSON.parse(firstText).page;
	assert.notEqual(created.id, source.id);
	assert.equal(created.parentId, source.parentId);
	assert.equal(created.title, "会議メモ のコピー");
	const duplicateDetail = await (await app.request("/api/pages/" + created.id, { headers: headers(cookiesA) })).json();
	assert.equal(duplicateDetail.content.revision, 0);
	assert.deepEqual(duplicateDetail.content.value.map(({ type, children }) => ({ type, children })), savedValue.map(({ type, children }) => ({ type, children })));
	const copiedIds = duplicateDetail.content.value.map((block) => block.id);
	assert.equal(new Set(copiedIds).size, copiedIds.length);
	assert.ok(copiedIds.every((id) => typeof id === "string" && /^[A-Za-z0-9_-]{10}$/.test(id)));
	assert.ok(copiedIds.every((id) => !savedValue.some((block) => block.id === id)));
	assert.deepEqual((await (await app.request("/api/pages/" + source.id, { headers: headers(cookiesA) })).json()), sourceBefore);
	const replay = await app.request("/api/pages/" + source.id + "/duplicate", { method: "POST", headers: headers(cookiesA), body: JSON.stringify(input) });
	const replayText = await replay.text();
	assert.equal(replay.status, 200, replayText);
	assert.equal(JSON.parse(replayText).page.id, created.id);
	assert.equal(count("page_duplicate_requests"), 1);
	assert.equal(count("pages"), 4);
	const firstList = await (await app.request("/api/pages", { headers: headers(cookiesA) })).json();
	assert.equal(firstList.pages.some((page) => page.id === descendant.id && page.parentId === source.id), true);
	assert.equal(firstList.pages.some((page) => page.parentId === created.id), false);

	// Editing the duplicate cannot change the source; replay returns its latest Page without replacing its content.
	const edit = await app.request("/api/pages/" + created.id + "/content", { method: "PUT", headers: headers(cookiesA), body: JSON.stringify({ revision: 0, value: [{ type: "p", children: [{ text: "独立編集" }] }] }) });
	assert.equal(edit.status, 200);
	const rename = await app.request("/api/pages/" + created.id, { method: "PATCH", headers: headers(cookiesA), body: JSON.stringify({ title: "複製後に改名" }) });
	assert.equal(rename.status, 200);
	const replayAfterEdit = await app.request("/api/pages/" + source.id + "/duplicate", { method: "POST", headers: headers(cookiesA), body: JSON.stringify(input) });
	assert.equal(replayAfterEdit.status, 200);
	assert.equal((await replayAfterEdit.json()).page.title, "複製後に改名");
	const afterDuplicateEdit = await (await app.request("/api/pages/" + created.id, { headers: headers(cookiesA) })).json();
	assert.equal(afterDuplicateEdit.content.revision, 1);
	assert.deepEqual(afterDuplicateEdit.content.value[0].children, [{ text: "独立編集" }]);
	assert.deepEqual((await (await app.request("/api/pages/" + source.id, { headers: headers(cookiesA) })).json()).content.value, savedValue);

	// Concurrent retries share one durable request record and one target ID.
	const concurrentInput = { ...input, requestId: "e5e5e5e5-e5e5-45e5-85e5-e5e5e5e5e5e5" };
	const sendConcurrent = () => app.request("/api/pages/" + source.id + "/duplicate", { method: "POST", headers: headers(cookiesA), body: JSON.stringify(concurrentInput) });
	const concurrent = await Promise.all([sendConcurrent(), sendConcurrent()]);
	assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 201]);
	const concurrentIds = await Promise.all(concurrent.map(async (response) => (await response.json()).page.id));
	assert.equal(new Set(concurrentIds).size, 1);
	assert.equal(count("page_duplicate_requests"), 2);
	assert.equal(count("pages"), 5);

	const beforeConflict = [count("pages"), count("page_contents"), count("page_duplicate_requests")];
	const changed = await app.request("/api/pages/" + source.id + "/duplicate", { method: "POST", headers: headers(cookiesA), body: JSON.stringify({ ...input, requestId: "f6f6f6f6-f6f6-46f6-86f6-f6f6f6f6f6f6", expectedContentRevision: 0 }) });
	assert.equal(changed.status, 409);
	assert.deepEqual(await changed.json(), { message: "Source page changed", code: "SOURCE_PAGE_CHANGED" });
	assert.deepEqual([count("pages"), count("page_contents"), count("page_duplicate_requests")], beforeConflict);
	const keyConflict = await app.request("/api/pages/" + source.id + "/duplicate", { method: "POST", headers: headers(cookiesA), body: JSON.stringify({ ...concurrentInput, expectedTitle: "別の入力" }) });
	assert.equal(keyConflict.status, 409);
	assert.deepEqual(await keyConflict.json(), { message: "Duplicate request conflict", code: "DUPLICATE_REQUEST_CONFLICT" });
	const stolen = await app.request("/api/pages/" + source.id + "/duplicate", { method: "POST", headers: headers(cookiesB), body: JSON.stringify(input) });
	assert.equal(stolen.status, 404);
	const unauth = await app.request("/api/pages/" + source.id + "/duplicate", { method: "POST", headers: jsonHeaders, body: JSON.stringify(input) });
	assert.equal(unauth.status, 401);
	assert.deepEqual([count("pages"), count("page_contents"), count("page_duplicate_requests")], beforeConflict);

	// A deleted target stays unavailable on replay; the key never creates a replacement.
	await runtime.dbRuntime.client.write.execute((db) => db.update(pages).set({ deletedAt: new Date() }).where(eq(pages.id, created.id)).run());
	const unavailable = await app.request("/api/pages/" + source.id + "/duplicate", { method: "POST", headers: headers(cookiesA), body: JSON.stringify(input) });
	assert.equal(unavailable.status, 409);
	assert.deepEqual(await unavailable.json(), { message: "Duplicated page unavailable", code: "DUPLICATED_PAGE_UNAVAILABLE" });
	assert.equal(count("pages"), 5);
	assert.equal(count("page_duplicate_requests"), 2);

	const longTitle = "🙂".repeat(100);
	const longPageResponse = await app.request("/api/pages", { method: "POST", headers: headers(cookiesA), body: JSON.stringify({ title: longTitle }) });
	assert.equal(longPageResponse.status, 201);
	const longPage = (await longPageResponse.json()).page;
	const longDuplicate = await app.request("/api/pages/" + longPage.id + "/duplicate", { method: "POST", headers: headers(cookiesA), body: JSON.stringify({ requestId: "b8b8b8b8-b8b8-48b8-88b8-b8b8b8b8b8b8", expectedContentRevision: 0, expectedTitle: longTitle, expectedParentId: null }) });
	assert.equal(longDuplicate.status, 201);
	const longDuplicateTitle = (await longDuplicate.json()).page.title;
	assert.equal(longDuplicateTitle.endsWith(" のコピー"), true);
	assert.ok(longDuplicateTitle.length <= 200);
	assert.ok(!/[\uD800-\uDBFF]$/.test(longDuplicateTitle));

	await runtime.dbRuntime.client.write.execute((db) => {
		db.run(sql.raw("CREATE TRIGGER fail_duplicate_record BEFORE INSERT ON page_duplicate_requests BEGIN SELECT RAISE(ABORT, 'forced operation record failure'); END"));
	});
	const countsBeforeFailure = [count("pages"), count("page_contents"), count("page_duplicate_requests")];
	const rollback = await app.request("/api/pages/" + source.id + "/duplicate", { method: "POST", headers: headers(cookiesA), body: JSON.stringify({ ...input, requestId: "c9c9c9c9-c9c9-49c9-89c9-c9c9c9c9c9c9" }) });
	assert.equal(rollback.status, 500);
	assert.deepEqual([count("pages"), count("page_contents"), count("page_duplicate_requests")], countsBeforeFailure);
	await runtime.dbRuntime.client.write.execute((db) => {
		db.run(sql.raw("DROP TRIGGER fail_duplicate_record"));
	});

	const fk = new Database(process.env.DATABASE_URL, { readonly: true });
	assert.deepEqual(fk.query("PRAGMA foreign_key_check").all(), []);
	fk.close();
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
					DATABASE_URL: path.join(directory, "duplicate.sqlite"),
					JWT_SECRET: "hono-page-duplicate-test-secret-32",
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

it("rejects a copied document that exceeds the saved-content limit", () => {
	const directory = mkdtempSync(
		path.join(tmpdir(), "hono-page-duplicate-size-"),
	);
	try {
		const result = spawnSync(
			"bun",
			[
				"-e",
				`
import assert from "node:assert/strict";
import { Database } from "bun:sqlite";
import { runSqliteMigrations } from "./api/db/migrate-sqlite.ts";
import { AuthService } from "./api/modules/auth/auth.service.ts";
import { updatePageContentInputSchema } from "./shared/schemas/page-content.schema.ts";
const origin = "http://localhost:5173";
const jsonHeaders = { "Content-Type": "application/json", Origin: origin };
await runSqliteMigrations({ databaseUrl: process.env.DATABASE_URL });
const { default: app, getAppRuntime } = await import("./api/app/hono.ts");
const runtime = await getAppRuntime();
try {
	const auth = new AuthService(runtime.dbRuntime.client, runtime.env);
	const user = await auth.createAdmin({ email: "duplicate-size@example.com", displayName: "Size", password: "password123456" });
	const login = await app.request("/api/auth/login", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ email: user.email, password: "password123456" }) });
	const cookie = login.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
	const headers = { ...jsonHeaders, Cookie: cookie };
	const created = await app.request("/api/pages", { method: "POST", headers, body: JSON.stringify({ title: "Large" }) });
	const page = (await created.json()).page;
	const value = [{ type: "p", children: Array.from({ length: 11 }, () => ({ text: "" })) }];
	const base = new TextEncoder().encode(JSON.stringify(value)).length;
	let remaining = 1024 * 1024 - base;
	for (const child of value[0].children) {
		const size = Math.min(100000, remaining);
		child.text = "x".repeat(size);
		remaining -= size;
	}
	assert.equal(remaining, 0);
	assert.equal(updatePageContentInputSchema.safeParse({ revision: 0, value }).success, true);
	const saved = await app.request("/api/pages/" + page.id + "/content", { method: "PUT", headers, body: JSON.stringify({ revision: 0, value }) });
	assert.equal(saved.status, 200, await saved.text());
	const countPages = () => { const db = new Database(process.env.DATABASE_URL, { readonly: true }); try { return db.query("SELECT COUNT(*) AS n FROM pages").get().n; } finally { db.close(); } };
	const before = countPages();
	const duplicate = await app.request("/api/pages/" + page.id + "/duplicate", { method: "POST", headers, body: JSON.stringify({ requestId: "a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7", expectedContentRevision: 1, expectedTitle: "Large", expectedParentId: null }) });
	const duplicateText = await duplicate.text();
	assert.equal(duplicate.status, 413, duplicateText);
	assert.deepEqual(JSON.parse(duplicateText), { message: "Duplicated content exceeds limit" });
	assert.equal(countPages(), before);
	const db = new Database(process.env.DATABASE_URL, { readonly: true });
	assert.equal(db.query("SELECT COUNT(*) AS n FROM page_duplicate_requests").get().n, 0);
	db.close();
} finally { await runtime.dbRuntime.close(); }
`,
			],
			{
				encoding: "utf8",
				cwd: process.cwd(),
				env: {
					...process.env,
					NODE_ENV: "test",
					DATABASE_URL: path.join(directory, "duplicate-size.sqlite"),
					JWT_SECRET: "hono-page-duplicate-size-secret-32",
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
