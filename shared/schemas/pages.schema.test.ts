import { describe, expect, it } from "vitest";
import { pageContentValueSchema } from "./page-content.schema";
import {
	EMPTY_PAGE_VALUE,
	createPageInputSchema,
	duplicatePageInputSchema,
	getPageResponseSchema,
	pageIdParamSchema,
	pageSchema,
	movePageInputSchema,
	updatePageTitleInputSchema,
} from "./pages.schema";

const validPage = {
	id: "a1a1a1a1-a1a1-41a1-a1a1-a1a1a1a1a1a1",
	ownerId: "b2b2b2b2-b2b2-42b2-b2b2-b2b2b2b2b2b2",
	parentId: null,
	title: "無題",
	createdAt: "2026-09-30T00:00:00.000Z",
	updatedAt: "2026-09-30T00:00:00.000Z",
};

describe("createPageInputSchema", () => {
	it("accepts a title and optional parentId", () => {
		expect(createPageInputSchema.parse({ title: "  無題  " })).toEqual({
			title: "無題",
			parentId: null,
		});
		expect(
			createPageInputSchema.parse({
				title: "子",
				parentId: validPage.id,
			}),
		).toEqual({
			title: "子",
			parentId: validPage.id,
		});
		expect(
			createPageInputSchema.parse({
				title: "root",
				parentId: null,
			}),
		).toEqual({
			title: "root",
			parentId: null,
		});
	});

	it("rejects blank titles, invalid UUIDs, and unknown keys", () => {
		expect(createPageInputSchema.safeParse({ title: "   " }).success).toBe(
			false,
		);
		expect(createPageInputSchema.safeParse({ title: "" }).success).toBe(false);
		expect(createPageInputSchema.safeParse({}).success).toBe(false);
		expect(
			createPageInputSchema.safeParse({
				title: "x".repeat(201),
			}).success,
		).toBe(false);
		expect(
			createPageInputSchema.safeParse({
				title: "無題",
				parentId: "not-a-uuid",
			}).success,
		).toBe(false);
		expect(
			createPageInputSchema.safeParse({
				title: "無題",
				ownerId: validPage.ownerId,
			}).success,
		).toBe(false);
	});
});

describe("updatePageTitleInputSchema", () => {
	it("accepts only a trimmed title", () => {
		expect(
			updatePageTitleInputSchema.parse({ title: "  新しいタイトル  " }),
		).toEqual({
			title: "新しいタイトル",
		});
	});

	it("rejects extra keys including parentId and ownerId", () => {
		expect(
			updatePageTitleInputSchema.safeParse({
				title: "新しいタイトル",
				parentId: null,
			}).success,
		).toBe(false);
		expect(
			updatePageTitleInputSchema.safeParse({
				title: "新しいタイトル",
				ownerId: validPage.ownerId,
			}).success,
		).toBe(false);
	});
});

describe("movePageInputSchema", () => {
	it("requires both parent values and accepts null as the root", () => {
		expect(
			movePageInputSchema.parse({
				parentId: null,
				expectedParentId: validPage.id,
			}),
		).toEqual({ parentId: null, expectedParentId: validPage.id });
		expect(
			movePageInputSchema.safeParse({ parentId: validPage.id }).success,
		).toBe(false);
		expect(
			movePageInputSchema.safeParse({ parentId: "bad", expectedParentId: null })
				.success,
		).toBe(false);
	});

	it("rejects unknown keys and leaves title PATCH parent-free", () => {
		expect(
			movePageInputSchema.safeParse({
				parentId: null,
				expectedParentId: null,
				ownerId: validPage.ownerId,
			}).success,
		).toBe(false);
		expect(
			updatePageTitleInputSchema.safeParse({ title: "Title", parentId: null })
				.success,
		).toBe(false);
	});
});

describe("duplicatePageInputSchema", () => {
	const validInput = {
		requestId: "d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4",
		expectedContentRevision: 3,
		expectedTitle: "会議メモ",
		expectedParentId: null,
	};

	it("accepts the strict saved-source snapshot", () => {
		expect(duplicatePageInputSchema.parse(validInput)).toEqual(validInput);
	});

	it("rejects omitted, malformed, unsafe, and caller-controlled fields", () => {
		expect(
			duplicatePageInputSchema.safeParse({
				...validInput,
				targetId: validPage.id,
			}).success,
		).toBe(false);
		expect(
			duplicatePageInputSchema.safeParse({
				...validInput,
				expectedContentRevision: Number.MAX_SAFE_INTEGER + 1,
			}).success,
		).toBe(false);
		expect(
			duplicatePageInputSchema.safeParse({
				...validInput,
				expectedParentId: "bad",
			}).success,
		).toBe(false);
		expect(
			duplicatePageInputSchema.safeParse({ ...validInput, requestId: "bad" })
				.success,
		).toBe(false);
	});
});

describe("pageIdParamSchema", () => {
	it("requires a UUID page id", () => {
		expect(pageIdParamSchema.parse({ id: validPage.id })).toEqual({
			id: validPage.id,
		});
		expect(pageIdParamSchema.safeParse({ id: "not-a-uuid" }).success).toBe(
			false,
		);
	});
});

describe("pageSchema", () => {
	it("accepts a page payload with ISO timestamps", () => {
		expect(pageSchema.parse(validPage)).toEqual(validPage);
	});
});

describe("EMPTY_PAGE_VALUE", () => {
	it("is a single empty paragraph node accepted as page content", () => {
		expect(EMPTY_PAGE_VALUE).toEqual([{ type: "p", children: [{ text: "" }] }]);
		expect(pageContentValueSchema.parse(EMPTY_PAGE_VALUE)).toEqual([
			{ type: "p", children: [{ text: "" }] },
		]);
		expect(
			getPageResponseSchema.parse({
				page: validPage,
				content: { revision: 0, value: EMPTY_PAGE_VALUE },
			}).content.revision,
		).toBe(0);
	});
});
