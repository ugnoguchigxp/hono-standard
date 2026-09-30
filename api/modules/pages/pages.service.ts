import { randomBytes, randomUUID } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
	type PageContentValue,
	pageContentValueSchema,
	type SavedPageContent,
	savedPageContentSchema,
	type UpdatePageContentInput,
} from "../../../shared/schemas/page-content.schema";
import {
	type CreatePageInput,
	type DuplicatePageInput,
	EMPTY_PAGE_VALUE,
	type Page,
	type PageContent,
	type MovePageInput,
	type PageSummary,
} from "../../../shared/schemas/pages.schema";
import { HttpError } from "../../app/http-error";
import type { AppDatabase, AppDatabaseClient } from "../../db";
import { pageContents, pageDuplicateRequests, pages } from "../../db/schema";

const notFound = () => new HttpError(404, "Not found");
const internalError = () => new HttpError(500, "Internal server error");
const MAX_PAGE_CONTENT_BYTES = 1024 * 1024;
const DUPLICATE_SUFFIX = " のコピー";
const BLOCK_ID_ALPHABET =
	"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-";

export class PageDuplicateError extends HttpError {
	readonly code:
		| "SOURCE_PAGE_CHANGED"
		| "DUPLICATE_REQUEST_CONFLICT"
		| "DUPLICATED_PAGE_UNAVAILABLE";

	constructor(code: PageDuplicateError["code"], message: string) {
		super(409, message);
		this.name = "PageDuplicateError";
		this.code = code;
	}
}

export class DuplicatedContentTooLargeError extends HttpError {
	constructor() {
		super(413, "Duplicated content exceeds limit");
		this.name = "DuplicatedContentTooLargeError";
	}
}

function duplicateTitle(title: string): string {
	let prefix = "";
	for (const character of title) {
		if (prefix.length + character.length + DUPLICATE_SUFFIX.length > 200) break;
		prefix += character;
	}
	return `${prefix}${DUPLICATE_SUFFIX}`;
}

function newBlockId(): string {
	const bytes = randomBytes(10);
	let id = "";
	for (const byte of bytes) id += BLOCK_ID_ALPHABET[byte & 63];
	return id;
}

function duplicateValue(value: PageContentValue): PageContentValue {
	const used = new Set<string>();
	for (const block of value) if (block.id) used.add(block.id);
	return value.map((block) => {
		let id = newBlockId();
		while (used.has(id)) id = newBlockId();
		used.add(id);
		return {
			...block,
			id,
			children: block.children.map((child) => ({ ...child })),
		};
	});
}

function jsonByteLength(value: unknown): number {
	return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export class ContentRevisionConflictError extends Error {
	readonly currentRevision: number;

	constructor(currentRevision: number) {
		super("Content revision conflict");
		this.name = "ContentRevisionConflictError";
		this.currentRevision = currentRevision;
	}
}

export class PageParentConflictError extends Error {
	readonly currentParentId: string | null;

	constructor(currentParentId: string | null) {
		super("Page parent conflict");
		this.name = "PageParentConflictError";
		this.currentParentId = currentParentId;
	}
}

export class InvalidPageHierarchyError extends Error {
	constructor() {
		super("Invalid page hierarchy");
		this.name = "InvalidPageHierarchyError";
	}
}

const toIsoString = (value: Date): string => value.toISOString();

const toPage = (row: typeof pages.$inferSelect): Page => ({
	id: row.id,
	ownerId: row.ownerId,
	parentId: row.parentId ?? null,
	title: row.title,
	createdAt: toIsoString(row.createdAt),
	updatedAt: toIsoString(row.updatedAt),
});

const toPageSummary = (row: typeof pages.$inferSelect): PageSummary => {
	const page = toPage(row);
	return {
		id: page.id,
		parentId: page.parentId,
		title: page.title,
		createdAt: page.createdAt,
		updatedAt: page.updatedAt,
	};
};

const parseStoredPageValue = (valueJson: string): PageContentValue => {
	try {
		const parsed: unknown = JSON.parse(valueJson);
		return pageContentValueSchema.parse(parsed);
	} catch (error) {
		if (error instanceof HttpError) {
			throw error;
		}
		throw internalError();
	}
};

const ownedPageCondition = (ownerId: string, pageId: string) =>
	and(
		eq(pages.id, pageId),
		eq(pages.ownerId, ownerId),
		isNull(pages.deletedAt),
	);

export function createPagesService(client: AppDatabaseClient) {
	return {
		async createPage(ownerId: string, input: CreatePageInput): Promise<Page> {
			const parentId = input.parentId;
			const now = new Date();
			const created = await client.write.execute((db: AppDatabase) =>
				db.transaction((tx) => {
					if (parentId) {
						const parent = tx
							.select({ id: pages.id })
							.from(pages)
							.where(ownedPageCondition(ownerId, parentId))
							.get();
						if (!parent) {
							throw notFound();
						}
					}
					const inserted = tx
						.insert(pages)
						.values({
							ownerId,
							parentId,
							title: input.title,
							createdAt: now,
							updatedAt: now,
						})
						.returning()
						.get();
					if (!inserted) {
						throw internalError();
					}
					tx.insert(pageContents)
						.values({
							pageId: inserted.id,
							valueJson: JSON.stringify(EMPTY_PAGE_VALUE),
							revision: 0,
							updatedAt: now,
						})
						.run();
					return inserted;
				}),
			);
			return toPage(created);
		},

		async listPages(ownerId: string): Promise<PageSummary[]> {
			const rows = await client.read.query.pages.findMany({
				where: and(eq(pages.ownerId, ownerId), isNull(pages.deletedAt)),
				orderBy: [asc(pages.createdAt), asc(pages.id)],
			});
			return rows.map(toPageSummary);
		},

		async getPage(
			ownerId: string,
			pageId: string,
		): Promise<{ page: Page; content: PageContent }> {
			const page = await client.read.query.pages.findFirst({
				where: ownedPageCondition(ownerId, pageId),
			});
			if (!page) {
				throw notFound();
			}
			const content = await client.read.query.pageContents.findFirst({
				where: eq(pageContents.pageId, pageId),
			});
			if (!content) {
				throw internalError();
			}
			return {
				page: toPage(page),
				content: {
					revision: content.revision,
					value: parseStoredPageValue(content.valueJson),
				},
			};
		},

		async renamePage(
			ownerId: string,
			pageId: string,
			title: string,
		): Promise<Page> {
			const now = new Date();
			const updated = await client.write.execute((db: AppDatabase) =>
				db
					.update(pages)
					.set({ title, updatedAt: now })
					.where(ownedPageCondition(ownerId, pageId))
					.returning()
					.get(),
			);
			if (!updated) {
				throw notFound();
			}
			return toPage(updated);
		},

		async movePage(
			ownerId: string,
			pageId: string,
			input: MovePageInput,
		): Promise<Page> {
			return client.write.execute((db: AppDatabase) =>
				db.transaction((tx) => {
					const source = tx
						.select()
						.from(pages)
						.where(ownedPageCondition(ownerId, pageId))
						.get();
					if (!source) throw notFound();

					if (input.parentId !== null) {
						const destination = tx
							.select({ id: pages.id })
							.from(pages)
							.where(ownedPageCondition(ownerId, input.parentId))
							.get();
						if (!destination) throw notFound();
					}

					const validateExistingChain = (startId: string | null) => {
						const visited = new Set<string>();
						let currentId = startId;
						while (currentId !== null) {
							if (currentId === pageId || visited.has(currentId)) {
								throw internalError();
							}
							visited.add(currentId);
							const ancestor = tx
								.select({ id: pages.id, parentId: pages.parentId })
								.from(pages)
								.where(ownedPageCondition(ownerId, currentId))
								.get();
							if (!ancestor) throw internalError();
							currentId = ancestor.parentId ?? null;
						}
					};
					validateExistingChain(source.parentId ?? null);

					if ((source.parentId ?? null) !== input.expectedParentId) {
						throw new PageParentConflictError(source.parentId ?? null);
					}
					if ((source.parentId ?? null) === input.parentId)
						return toPage(source);

					const visited = new Set<string>();
					let ancestorId = input.parentId;
					while (ancestorId !== null) {
						if (ancestorId === pageId) throw new InvalidPageHierarchyError();
						if (visited.has(ancestorId)) throw internalError();
						visited.add(ancestorId);
						const ancestor = tx
							.select({ id: pages.id, parentId: pages.parentId })
							.from(pages)
							.where(ownedPageCondition(ownerId, ancestorId))
							.get();
						if (!ancestor) throw internalError();
						ancestorId = ancestor.parentId ?? null;
					}

					const now = new Date();
					const parentCondition =
						input.expectedParentId === null
							? isNull(pages.parentId)
							: eq(pages.parentId, input.expectedParentId);
					const updated = tx
						.update(pages)
						.set({ parentId: input.parentId, updatedAt: now })
						.where(
							and(
								eq(pages.id, pageId),
								eq(pages.ownerId, ownerId),
								isNull(pages.deletedAt),
								parentCondition,
							),
						)
						.returning()
						.all();
					if (updated.length === 1 && updated[0]) return toPage(updated[0]);

					const current = tx
						.select({ parentId: pages.parentId })
						.from(pages)
						.where(ownedPageCondition(ownerId, pageId))
						.get();
					if (!current) throw notFound();
					if ((current.parentId ?? null) !== input.expectedParentId) {
						throw new PageParentConflictError(current.parentId ?? null);
					}
					throw internalError();
				}),
			);
		},

		async duplicatePage(
			ownerId: string,
			sourceId: string,
			input: DuplicatePageInput,
		): Promise<{ page: Page; replayed: boolean }> {
			const now = new Date();
			return client.write.execute((db: AppDatabase) =>
				db.transaction((tx) => {
					const expected = JSON.stringify({
						expectedContentRevision: input.expectedContentRevision,
						expectedTitle: input.expectedTitle,
						expectedParentId: input.expectedParentId,
					});
					const prior = tx
						.select()
						.from(pageDuplicateRequests)
						.where(
							and(
								eq(pageDuplicateRequests.ownerId, ownerId),
								eq(pageDuplicateRequests.requestId, input.requestId),
							),
						)
						.get();
					if (prior) {
						if (
							prior.sourcePageId !== sourceId ||
							prior.inputJson !== expected
						) {
							throw new PageDuplicateError(
								"DUPLICATE_REQUEST_CONFLICT",
								"Duplicate request conflict",
							);
						}
						const duplicated = tx
							.select()
							.from(pages)
							.where(ownedPageCondition(ownerId, prior.createdPageId))
							.get();
						if (!duplicated) {
							throw new PageDuplicateError(
								"DUPLICATED_PAGE_UNAVAILABLE",
								"Duplicated page unavailable",
							);
						}
						return { page: toPage(duplicated), replayed: true };
					}

					const source = tx
						.select()
						.from(pages)
						.where(ownedPageCondition(ownerId, sourceId))
						.get();
					if (!source) throw notFound();
					if (source.parentId) {
						const parent = tx
							.select()
							.from(pages)
							.where(ownedPageCondition(ownerId, source.parentId))
							.get();
						if (!parent) throw notFound();
						const visited = new Set<string>();
						let ancestor: typeof pages.$inferSelect | undefined = parent;
						while (ancestor) {
							if (visited.has(ancestor.id)) throw internalError();
							visited.add(ancestor.id);
							if (!ancestor.parentId) break;
							ancestor = tx
								.select()
								.from(pages)
								.where(ownedPageCondition(ownerId, ancestor.parentId))
								.get();
							if (!ancestor) throw internalError();
						}
					}
					const content = tx
						.select()
						.from(pageContents)
						.where(eq(pageContents.pageId, sourceId))
						.get();
					if (!content) throw internalError();
					const value = parseStoredPageValue(content.valueJson);
					if (
						content.revision !== input.expectedContentRevision ||
						source.title !== input.expectedTitle ||
						(source.parentId ?? null) !== input.expectedParentId
					) {
						throw new PageDuplicateError(
							"SOURCE_PAGE_CHANGED",
							"Source page changed",
						);
					}
					const copiedValue = duplicateValue(value);
					if (jsonByteLength(copiedValue) > MAX_PAGE_CONTENT_BYTES) {
						throw new DuplicatedContentTooLargeError();
					}
					const created = tx
						.insert(pages)
						.values({
							id: randomUUID(),
							ownerId,
							parentId: source.parentId,
							title: duplicateTitle(source.title),
							createdAt: now,
							updatedAt: now,
						})
						.returning()
						.get();
					if (!created) throw internalError();
					tx.insert(pageContents)
						.values({
							pageId: created.id,
							valueJson: JSON.stringify(copiedValue),
							revision: 0,
							updatedAt: now,
						})
						.run();
					tx.insert(pageDuplicateRequests)
						.values({
							ownerId,
							requestId: input.requestId,
							sourcePageId: sourceId,
							inputJson: expected,
							createdPageId: created.id,
							createdAt: now,
						})
						.run();
					return { page: toPage(created), replayed: false };
				}),
			);
		},

		async updatePageContent(
			ownerId: string,
			pageId: string,
			input: UpdatePageContentInput,
		): Promise<{
			content: SavedPageContent;
			page: { id: string; updatedAt: Date };
		}> {
			const valueJson = JSON.stringify(input.value);
			return client.write.execute((db: AppDatabase) =>
				db.transaction((tx) => {
					const page = tx
						.select({ id: pages.id, updatedAt: pages.updatedAt })
						.from(pages)
						.where(ownedPageCondition(ownerId, pageId))
						.get();
					if (!page) {
						throw notFound();
					}
					const now = new Date(
						Math.max(Date.now(), page.updatedAt.getTime() + 1000),
					);
					const current = tx
						.select({ revision: pageContents.revision })
						.from(pageContents)
						.where(eq(pageContents.pageId, pageId))
						.get();
					if (!current) {
						throw internalError();
					}
					if (current.revision !== input.revision) {
						throw new ContentRevisionConflictError(current.revision);
					}
					const updated = tx
						.update(pageContents)
						.set({
							valueJson,
							revision: input.revision + 1,
							updatedAt: now,
						})
						.where(
							and(
								eq(pageContents.pageId, pageId),
								eq(pageContents.revision, input.revision),
							),
						)
						.returning({
							revision: pageContents.revision,
							valueJson: pageContents.valueJson,
						})
						.all();
					if (updated.length !== 1 || !updated[0]) {
						throw internalError();
					}
					if (updated[0].revision !== input.revision + 1) {
						throw internalError();
					}
					const updatedPage = tx
						.update(pages)
						.set({ updatedAt: now })
						.where(ownedPageCondition(ownerId, pageId))
						.returning({ id: pages.id, updatedAt: pages.updatedAt })
						.get();
					if (!updatedPage) {
						throw internalError();
					}
					try {
						return {
							content: savedPageContentSchema.parse({
								revision: updated[0].revision,
								value: parseStoredPageValue(updated[0].valueJson),
							}),
							page: updatedPage,
						};
					} catch (error) {
						if (error instanceof HttpError) {
							throw error;
						}
						throw internalError();
					}
				}),
			);
		},
	};
}

export type PagesService = ReturnType<typeof createPagesService>;
