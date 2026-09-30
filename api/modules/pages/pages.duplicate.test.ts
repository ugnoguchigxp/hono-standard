import { describe, expect, it } from "vitest";
import type { DuplicatePageInput } from "../../../shared/schemas/pages.schema";
import type { AppDatabase, AppDatabaseClient } from "../../db";
import { pageContents, pageDuplicateRequests, pages } from "../../db/schema";
import { createPagesService } from "./pages.service";

const now = new Date(0);
const row = (overrides: Record<string, unknown> = {}) => ({
	id: "source",
	ownerId: "owner",
	parentId: null,
	title: "Source",
	createdAt: now,
	updatedAt: now,
	deletedAt: null,
	...overrides,
});
const input: DuplicatePageInput = {
	requestId: "request",
	expectedTitle: "Source",
	expectedContentRevision: 2,
	expectedParentId: null,
};
const content = {
	revision: 2,
	valueJson: JSON.stringify([
		{
			type: "p",
			id: "original01",
			children: [{ text: "retained", bold: true }],
		},
	]),
};
function service(reads: unknown[], inserted: unknown = row({ id: "copy" })) {
	const writes: Array<{ table: unknown; values: Record<string, unknown> }> = [];
	const tx = {
		select: () => ({
			from: () => ({ where: () => ({ get: () => reads.shift() }) }),
		}),
		insert: (table: unknown) => ({
			values: (values: Record<string, unknown>) => {
				writes.push({ table, values });
				return {
					returning: () => ({ get: () => inserted }),
					run: () => undefined,
				};
			},
		}),
	};
	const client = {
		read: {},
		write: {
			execute: async <T>(operation: (db: AppDatabase) => T) =>
				operation({
					transaction: (fn: (db: unknown) => T) => fn(tx),
				} as unknown as AppDatabase),
		},
	} as unknown as AppDatabaseClient;
	return { api: createPagesService(client), writes };
}
const expected = JSON.stringify({
	expectedContentRevision: 2,
	expectedTitle: "Source",
	expectedParentId: null,
});
const prior = {
	sourcePageId: "source",
	createdPageId: "copy",
	inputJson: expected,
};
describe("duplicate page transaction", () => {
	it("copies only the source, preserves marks, resets revision and records idempotency", async () => {
		const { api, writes } = service([undefined, row(), content]);
		expect(await api.duplicatePage("owner", "source", input)).toMatchObject({
			page: { id: "copy" },
			replayed: false,
		});
		expect(writes.map((w) => w.table)).toEqual([
			pages,
			pageContents,
			pageDuplicateRequests,
		]);
		expect(writes[0]?.values).toMatchObject({
			ownerId: "owner",
			parentId: null,
			title: "Source のコピー",
		});
		expect(writes[1]?.values).toMatchObject({ pageId: "copy", revision: 0 });
		const value = JSON.parse(String(writes[1]?.values.valueJson));
		expect(value[0].id).not.toBe("original01");
		expect(value[0].children).toEqual([{ text: "retained", bold: true }]);
		expect(writes[2]?.values).toMatchObject({
			ownerId: "owner",
			requestId: "request",
			sourcePageId: "source",
			createdPageId: "copy",
			inputJson: expected,
		});
	});
	it("replays an owned recorded result without inserting", async () => {
		const { api, writes } = service([prior, row({ id: "copy" })]);
		expect(await api.duplicatePage("owner", "source", input)).toMatchObject({
			replayed: true,
		});
		expect(writes).toEqual([]);
	});
	it.each([
		{ ...prior, sourcePageId: "another" },
		{ ...prior, inputJson: "different" },
	])("rejects reused keys with different snapshots %j", async (record) => {
		const { api, writes } = service([record]);
		await expect(
			api.duplicatePage("owner", "source", input),
		).rejects.toMatchObject({ code: "DUPLICATE_REQUEST_CONFLICT" });
		expect(writes).toEqual([]);
	});
	it("rejects unavailable replay results", async () => {
		await expect(
			service([prior, undefined]).api.duplicatePage("owner", "source", input),
		).rejects.toMatchObject({ code: "DUPLICATED_PAGE_UNAVAILABLE" });
	});
	it("hides unavailable sources", async () => {
		await expect(
			service([undefined, undefined]).api.duplicatePage(
				"owner",
				"source",
				input,
			),
		).rejects.toMatchObject({ status: 404 });
	});
	it.each([
		{ expectedTitle: "changed" },
		{ expectedContentRevision: 3 },
		{ expectedParentId: "changed" },
	])("rejects stale source snapshots %j", async (change) => {
		const { api, writes } = service([undefined, row(), content]);
		await expect(
			api.duplicatePage("owner", "source", { ...input, ...change }),
		).rejects.toMatchObject({ code: "SOURCE_PAGE_CHANGED" });
		expect(writes).toEqual([]);
	});
	it("preserves a validated parent chain", async () => {
		const { api, writes } = service([
			undefined,
			row({ parentId: "parent" }),
			row({ id: "parent", parentId: "root" }),
			row({ id: "root" }),
			content,
		]);
		await api.duplicatePage("owner", "source", {
			...input,
			expectedParentId: "parent",
		});
		expect(writes[0]?.values.parentId).toBe("parent");
	});
	it.each(
		[
			[undefined, row({ parentId: "parent" }), undefined],
			[
				undefined,
				row({ parentId: "parent" }),
				row({ id: "parent", parentId: "missing" }),
				undefined,
			],
			[
				undefined,
				row({ parentId: "parent" }),
				row({ id: "parent", parentId: "parent" }),
				row({ id: "parent", parentId: "parent" }),
			],
			[undefined, row(), undefined],
			[undefined, row(), { ...content, valueJson: "invalid" }],
		].map((reads) => ({ reads })),
	)("rejects unavailable or corrupt source data without inserting", async ({
		reads,
	}) => {
		const { api, writes } = service([...reads]);
		await expect(api.duplicatePage("owner", "source", input)).rejects.toThrow();
		expect(writes).toEqual([]);
	});
	it("truncates Unicode titles at a complete codepoint", async () => {
		const title = "😀".repeat(100);
		const { api, writes } = service([undefined, row({ title }), content]);
		await api.duplicatePage("owner", "source", {
			...input,
			expectedTitle: title,
		});
		const copied = String(writes[0]?.values.title);
		expect(copied.length).toBeLessThanOrEqual(200);
		expect(copied).toBe("😀".repeat(97) + " のコピー");
	});
	it("rejects an absent insert result before content or key writes", async () => {
		const { api, writes } = service([undefined, row(), content], null);
		await expect(api.duplicatePage("owner", "source", input)).rejects.toThrow();
		expect(writes).toHaveLength(1);
	});
	it("rejects content that exceeds the byte limit after assigning block ids", async () => {
		const value = Array.from({ length: 11 }, () => ({
			type: "p",
			children: [{ text: "x".repeat(100_000) }],
		}));
		const { api, writes } = service([
			undefined,
			row(),
			{ revision: 2, valueJson: JSON.stringify(value) },
		]);
		await expect(
			api.duplicatePage("owner", "source", input),
		).rejects.toMatchObject({ status: 413 });
		expect(writes).toEqual([]);
	});
});
