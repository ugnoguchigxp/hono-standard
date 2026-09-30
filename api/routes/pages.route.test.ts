import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_PAGE_VALUE } from "../../shared/schemas/pages.schema";
import { HttpError } from "../app/http-error";
import {
	ContentRevisionConflictError,
	DuplicatedContentTooLargeError,
	InvalidPageHierarchyError,
	PageParentConflictError,
	PageDuplicateError,
	type PagesService,
} from "../modules/pages/pages.service";
import { createPagesRoute } from "./pages.route";

const ownerId = "a1a1a1a1-a1a1-41a1-a1a1-a1a1a1a1a1a1";
const page = {
	id: "c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3",
	ownerId,
	parentId: null,
	title: "無題",
	createdAt: "2026-09-30T00:00:00.000Z",
	updatedAt: "2026-09-30T00:00:00.000Z",
};

describe("pages route", () => {
	let app: Hono;
	let pagesService: {
		createPage: ReturnType<typeof vi.fn>;
		listPages: ReturnType<typeof vi.fn>;
		getPage: ReturnType<typeof vi.fn>;
		renamePage: ReturnType<typeof vi.fn>;
		movePage: ReturnType<typeof vi.fn>;
		updatePageContent: ReturnType<typeof vi.fn>;
		duplicatePage: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		pagesService = {
			createPage: vi.fn(),
			listPages: vi.fn(),
			getPage: vi.fn(),
			renamePage: vi.fn(),
			movePage: vi.fn(),
			updatePageContent: vi.fn(),
			duplicatePage: vi.fn(),
		};
		app = new Hono();
		app.onError((error, c) => {
			const status = error instanceof HttpError ? error.status : 500;
			return c.json({ message: error.message }, status as ContentfulStatusCode);
		});
		app.use("*", async (c, next) => {
			c.set("authUser", {
				userId: ownerId,
				email: "a@example.com",
				role: "member",
			});
			await next();
		});
		app.route(
			"/pages",
			createPagesRoute({
				pagesService: pagesService as unknown as PagesService,
			}),
		);
	});

	it.each([
		"DUPLICATE_REQUEST_CONFLICT",
		"DUPLICATED_PAGE_UNAVAILABLE",
	] as const)("returns typed duplicate failure %s", async (code) => {
		pagesService.duplicatePage.mockRejectedValue(
			new PageDuplicateError(code, "conflict"),
		);
		const response = await app.request(`/pages/${page.id}/duplicate`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				requestId: crypto.randomUUID(),
				expectedContentRevision: 0,
				expectedTitle: "無題",
				expectedParentId: null,
			}),
		});
		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({ message: "conflict", code });
	});
	it("returns a payload limit response for copied ids exceeding capacity", async () => {
		pagesService.duplicatePage.mockRejectedValue(
			new DuplicatedContentTooLargeError(),
		);
		const response = await app.request(`/pages/${page.id}/duplicate`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				requestId: crypto.randomUUID(),
				expectedContentRevision: 0,
				expectedTitle: "無題",
				expectedParentId: null,
			}),
		});
		expect(response.status).toBe(413);
	});

	it("creates, lists, reads, and renames pages", async () => {
		pagesService.createPage.mockResolvedValue(page);
		pagesService.listPages.mockResolvedValue([
			{
				id: page.id,
				parentId: page.parentId,
				title: page.title,
				createdAt: page.createdAt,
				updatedAt: page.updatedAt,
			},
		]);
		pagesService.getPage.mockResolvedValue({
			page,
			content: { revision: 0, value: [...EMPTY_PAGE_VALUE] },
		});
		pagesService.renamePage.mockResolvedValue({
			...page,
			title: "新しいタイトル",
		});

		const created = await app.request("/pages", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "無題" }),
		});
		const createdText = await created.text();
		expect(created.status).toBe(201);
		expect(JSON.parse(createdText)).toEqual({ page });
		expect(pagesService.createPage).toHaveBeenCalledWith(ownerId, {
			title: "無題",
			parentId: null,
		});

		const listed = await app.request("/pages");
		expect(listed.status).toBe(200);
		expect(await listed.json()).toEqual({
			pages: [
				{
					id: page.id,
					parentId: null,
					title: "無題",
					createdAt: page.createdAt,
					updatedAt: page.updatedAt,
				},
			],
		});

		const detail = await app.request(`/pages/${page.id}`);
		expect(detail.status).toBe(200);
		expect(await detail.json()).toEqual({
			page,
			content: { revision: 0, value: [...EMPTY_PAGE_VALUE] },
		});

		const renamed = await app.request(`/pages/${page.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "新しいタイトル" }),
		});
		expect(renamed.status).toBe(200);
		expect(await renamed.json()).toEqual({
			page: { ...page, title: "新しいタイトル" },
		});
		expect(pagesService.renamePage).toHaveBeenCalledWith(
			ownerId,
			page.id,
			"新しいタイトル",
		);
	});

	it("returns 201 for first duplicate and 200 for the same operation replay", async () => {
		const input = {
			requestId: "d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4",
			expectedContentRevision: 0,
			expectedTitle: "無題",
			expectedParentId: null,
		};
		pagesService.duplicatePage
			.mockResolvedValueOnce({ page, replayed: false })
			.mockResolvedValueOnce({ page, replayed: true });
		const request = () =>
			app.request(`/pages/${page.id}/duplicate`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(input),
			});
		const first = await request();
		expect(first.status).toBe(201);
		expect(await first.json()).toEqual({ page });
		const replay = await request();
		expect(replay.status).toBe(200);
		expect(await replay.json()).toEqual({ page });
		expect(pagesService.duplicatePage).toHaveBeenCalledTimes(2);
		expect(pagesService.duplicatePage).toHaveBeenCalledWith(
			ownerId,
			page.id,
			input,
		);
	});

	it("maps coded duplicate conflicts and rejects unknown input before service call", async () => {
		pagesService.duplicatePage.mockRejectedValue(
			new PageDuplicateError("SOURCE_PAGE_CHANGED", "Source page changed"),
		);
		const response = await app.request(`/pages/${page.id}/duplicate`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				requestId: "d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4",
				expectedContentRevision: 0,
				expectedTitle: "無題",
				expectedParentId: null,
			}),
		});
		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			message: "Source page changed",
			code: "SOURCE_PAGE_CHANGED",
		});
		const invalid = await app.request(`/pages/${page.id}/duplicate`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				requestId: "d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4",
				expectedContentRevision: 0,
				expectedTitle: "無題",
				expectedParentId: null,
				value: [],
			}),
		});
		expect(invalid.status).toBe(400);
		expect(pagesService.duplicatePage).toHaveBeenCalledTimes(1);
	});

	it("rejects invalid identifiers and unknown keys", async () => {
		const invalidId = await app.request("/pages/not-a-uuid");
		expect(invalidId.status).toBe(400);
		expect(await invalidId.json()).toEqual({ message: "Invalid request" });
		const extraKey = await app.request("/pages", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "無題", ownerId }),
		});
		expect(extraKey.status).toBe(400);
		expect(await extraKey.json()).toEqual({ message: "Invalid request" });
		expect(pagesService.createPage).not.toHaveBeenCalled();
	});

	it("moves with a strict body and maps typed hierarchy conflicts", async () => {
		pagesService.movePage.mockResolvedValue({ ...page, parentId: ownerId });
		const moved = await app.request(`/pages/${page.id}/move`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parentId: ownerId, expectedParentId: null }),
		});
		expect(moved.status).toBe(200);
		expect(await moved.json()).toEqual({
			page: { ...page, parentId: ownerId },
		});
		expect(pagesService.movePage).toHaveBeenCalledWith(ownerId, page.id, {
			parentId: ownerId,
			expectedParentId: null,
		});

		pagesService.movePage.mockRejectedValueOnce(
			new PageParentConflictError(page.id),
		);
		const conflict = await app.request(`/pages/${page.id}/move`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parentId: null, expectedParentId: null }),
		});
		expect(conflict.status).toBe(409);
		expect(await conflict.json()).toEqual({
			message: "Page parent conflict",
			code: "PAGE_PARENT_CONFLICT",
			currentParentId: page.id,
		});

		pagesService.movePage.mockRejectedValueOnce(
			new InvalidPageHierarchyError(),
		);
		const invalidHierarchy = await app.request(`/pages/${page.id}/move`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parentId: null, expectedParentId: null }),
		});
		expect(invalidHierarchy.status).toBe(409);
		expect(await invalidHierarchy.json()).toEqual({
			message: "Invalid page hierarchy",
			code: "INVALID_PAGE_HIERARCHY",
		});

		const extraKey = await app.request(`/pages/${page.id}/move`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parentId: null, expectedParentId: null, ownerId }),
		});
		expect(extraKey.status).toBe(400);
	});

	it("saves content and returns the current revision on conflict", async () => {
		const value = [{ type: "p", children: [{ text: "hello" }] }];
		pagesService.updatePageContent.mockResolvedValue({
			content: { revision: 1, value },
			page: { id: page.id, updatedAt: new Date("2026-09-30T00:00:01.000Z") },
		});

		const saved = await app.request(`/pages/${page.id}/content`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ revision: 0, value }),
		});
		expect(saved.status).toBe(200);
		expect(await saved.json()).toEqual({
			content: { revision: 1, value },
			page: {
				id: page.id,
				updatedAt: "2026-09-30T00:00:01.000Z",
			},
		});
		expect(pagesService.updatePageContent).toHaveBeenCalledWith(
			ownerId,
			page.id,
			{
				revision: 0,
				value,
			},
		);

		pagesService.updatePageContent.mockRejectedValue(
			new ContentRevisionConflictError(2),
		);
		const conflict = await app.request(`/pages/${page.id}/content`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ revision: 0, value }),
		});
		expect(conflict.status).toBe(409);
		expect(await conflict.json()).toEqual({
			message: "Content revision conflict",
			currentRevision: 2,
		});
	});

	it("rejects invalid content before calling the service", async () => {
		const response = await app.request(`/pages/${page.id}/content`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ revision: 0, value: [] }),
		});
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ message: "Invalid request" });
		expect(pagesService.updatePageContent).not.toHaveBeenCalled();
	});

	it("propagates unexpected content save failures", async () => {
		pagesService.updatePageContent.mockRejectedValue(new Error("write failed"));
		const response = await app.request(`/pages/${page.id}/content`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				revision: 0,
				value: [{ type: "p", children: [{ text: "hello" }] }],
			}),
		});
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ message: "write failed" });
	});
});
