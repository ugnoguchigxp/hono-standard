import { describe, expect, it, vi } from "vitest";
import { pageContentValueSchema } from "../../../shared/schemas/page-content.schema";
import type { UpdatePageContentInput } from "../../../shared/schemas/page-content.schema";
import { EMPTY_PAGE_VALUE } from "../../../shared/schemas/pages.schema";
import { HttpError } from "../../app/http-error";
import type { AppDatabase, AppDatabaseClient } from "../../db";
import { pageContents, pages } from "../../db/schema";
import {
	ContentRevisionConflictError,
	InvalidPageHierarchyError,
	PageParentConflictError,
	createPagesService,
} from "./pages.service";

const input: UpdatePageContentInput = {
	revision: 0,
	value: [{ type: "p", children: [{ text: "hello" }] }],
};

function createService(options: {
	pageUpdateFails?: boolean;
	page?: { id: string; updatedAt?: Date };
	content?: { revision: number };
	updated?: Array<{ revision: number; valueJson: string } | undefined>;
}) {
	const tx = {
		select() {
			return {
				from(table: unknown) {
					return {
						where() {
							return {
								get() {
									if (table === pages) {
										return options.page
											? { updatedAt: new Date(0), ...options.page }
											: undefined;
									}
									if (table === pageContents) return options.content;
									throw new Error(`unexpected table: ${String(table)}`);
								},
							};
						},
					};
				},
			};
		},
		update(table: unknown) {
			let updatePageTimestamp: Date | undefined;
			return {
				set(values: { updatedAt?: Date }) {
					if (table === pages) updatePageTimestamp = values.updatedAt;
					return {
						where() {
							return {
								returning() {
									return {
										get() {
											return table === pages
												? options.pageUpdateFails
													? undefined
													: { id: "page-1", updatedAt: updatePageTimestamp }
												: undefined;
										},
										all() {
											return table === pageContents
												? (options.updated ?? [])
												: [];
										},
									};
								},
							};
						},
					};
				},
			};
		},
	};
	const client = {
		read: {},
		write: {
			execute: async <TResult>(operation: (database: AppDatabase) => TResult) =>
				operation({
					transaction: (fn: (transaction: typeof tx) => TResult) => fn(tx),
				} as unknown as AppDatabase),
			close: async () => undefined,
		},
	} as unknown as AppDatabaseClient;
	return createPagesService(client);
}

const now = new Date("2026-09-30T00:00:00.000Z");

function pageRow(
	overrides: Partial<{
		id: string;
		ownerId: string;
		parentId: string | null;
		title: string;
	}> = {},
) {
	return {
		id: "page-1",
		ownerId: "owner-1",
		parentId: null,
		title: "無題",
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
		...overrides,
	};
}

function createPageService(options: {
	parent?: { id: string };
	inserted?: ReturnType<typeof pageRow>;
	pages?: ReturnType<typeof pageRow>[];
	content?: { revision: number; valueJson: string };
	renamed?: ReturnType<typeof pageRow>;
}) {
	const client = {
		read: {
			query: {
				pages: {
					findMany: () => options.pages ?? [],
					findFirst: () => options.pages?.[0],
				},
				pageContents: {
					findFirst: () => options.content,
				},
			},
		},
		write: {
			execute: async <TResult>(operation: (database: AppDatabase) => TResult) =>
				operation({
					transaction(fn: (transaction: unknown) => TResult) {
						const tx = {
							select() {
								return {
									from() {
										return {
											where() {
												return { get: () => options.parent };
											},
										};
									},
								};
							},
							insert(table: unknown) {
								return {
									values() {
										return {
											returning() {
												return {
													get: () =>
														table === pages ? options.inserted : undefined,
												};
											},
											run() {
												return undefined;
											},
										};
									},
								};
							},
						};
						return fn(tx);
					},
					update() {
						return {
							set() {
								return {
									where() {
										return {
											returning() {
												return { get: () => options.renamed };
											},
										};
									},
								};
							},
						};
					},
				} as unknown as AppDatabase),
			close: async () => undefined,
		},
	} as unknown as AppDatabaseClient;
	return createPagesService(client);
}

function createMovePageService(options: {
	source?: ReturnType<typeof pageRow>;
	destination?: ReturnType<typeof pageRow>;
	ancestors?: Array<ReturnType<typeof pageRow> | undefined>;
	updateFails?: boolean;
	onUpdateFailure?: () => void;
}) {
	let updateCalls = 0;
	let ancestorIndex = 0;
	const source = options.source;
	const tx = {
		select(projection?: Record<string, unknown>) {
			return {
				from() {
					return {
						where() {
							return {
								get() {
									const keys = Object.keys(projection ?? {});
									if (keys.length === 0) return source;
									if (keys.length === 1 && keys[0] === "id") {
										return options.destination
											? { id: options.destination.id }
											: undefined;
									}
									if (keys.includes("parentId") && keys.includes("id")) {
										return options.ancestors?.[ancestorIndex++];
									}
									if (keys.length === 1 && keys[0] === "parentId") {
										return source ? { parentId: source.parentId } : undefined;
									}
									throw new Error(`unexpected projection ${keys.join(",")}`);
								},
							};
						},
					};
				},
			};
		},
		update() {
			return {
				set(values: { parentId: string | null; updatedAt: Date }) {
					return {
						where() {
							return {
								returning() {
									return {
										all() {
											updateCalls += 1;
											if (options.updateFails || !source) {
												options.onUpdateFailure?.();
												return [];
											}
											Object.assign(source, values);
											return [source];
										},
									};
								},
							};
						},
					};
				},
			};
		},
	};
	const client = {
		read: {},
		write: {
			execute: async <TResult>(operation: (database: AppDatabase) => TResult) =>
				operation({
					transaction: (fn: (transaction: typeof tx) => TResult) => fn(tx),
				} as unknown as AppDatabase),
			close: async () => undefined,
		},
	} as unknown as AppDatabaseClient;
	return {
		service: createPagesService(client),
		get updateCalls() {
			return updateCalls;
		},
	};
}

describe("page ownership operations", () => {
	it("creates, lists, reads, and renames an owned page", async () => {
		const created = pageRow();
		const service = createPageService({
			parent: { id: "page-1" },
			inserted: created,
			pages: [
				created,
				pageRow({ id: "page-2", parentId: "page-1", title: "子" }),
			],
			content: { revision: 0, valueJson: JSON.stringify(EMPTY_PAGE_VALUE) },
			renamed: pageRow({ title: "新しいタイトル" }),
		});

		await expect(
			service.createPage("owner-1", { title: "無題", parentId: null }),
		).resolves.toMatchObject({ id: "page-1", parentId: null, title: "無題" });
		const child = createPageService({
			parent: { id: "page-1" },
			inserted: pageRow({ id: "page-2", parentId: "page-1", title: "子" }),
		});
		await expect(
			child.createPage("owner-1", { title: "子", parentId: "page-1" }),
		).resolves.toMatchObject({
			id: "page-2",
			parentId: "page-1",
			title: "子",
		});
		await expect(service.listPages("owner-1")).resolves.toEqual([
			expect.objectContaining({ id: "page-1", title: "無題" }),
			expect.objectContaining({
				id: "page-2",
				parentId: "page-1",
				title: "子",
			}),
		]);
		await expect(service.getPage("owner-1", "page-1")).resolves.toEqual({
			page: expect.objectContaining({ id: "page-1" }),
			content: { revision: 0, value: EMPTY_PAGE_VALUE },
		});
		await expect(
			service.renamePage("owner-1", "page-1", "新しいタイトル"),
		).resolves.toMatchObject({ title: "新しいタイトル" });
	});

	it("rejects missing parents, pages, content, and failed inserts", async () => {
		const missingParent = createPageService({});
		await expect(
			missingParent.createPage("owner-1", {
				title: "子",
				parentId: "missing",
			}),
		).rejects.toMatchObject({ status: 404, message: "Not found" });

		const failedInsert = createPageService({ parent: { id: "page-1" } });
		await expect(
			failedInsert.createPage("owner-1", {
				title: "子",
				parentId: "page-1",
			}),
		).rejects.toMatchObject({ status: 500 });

		const missingPage = createPageService({ pages: [] });
		await expect(
			missingPage.getPage("owner-1", "missing"),
		).rejects.toMatchObject({ status: 404, message: "Not found" });
		await expect(
			missingPage.renamePage("owner-1", "missing", "新しいタイトル"),
		).rejects.toMatchObject({ status: 404 });

		const missingContent = createPageService({ pages: [pageRow()] });
		await expect(
			missingContent.getPage("owner-1", "page-1"),
		).rejects.toMatchObject({ status: 500 });

		const brokenContent = createPageService({
			pages: [pageRow()],
			content: { revision: 0, valueJson: "not-json" },
		});
		await expect(
			brokenContent.getPage("owner-1", "page-1"),
		).rejects.toMatchObject({ status: 500 });

		const emptyArrayContent = createPageService({
			pages: [pageRow()],
			content: { revision: 0, valueJson: "[]" },
		});
		await expect(
			emptyArrayContent.getPage("owner-1", "page-1"),
		).rejects.toMatchObject({ status: 500 });
	});
});

describe("movePage", () => {
	const destination = pageRow({
		id: "page-2",
		parentId: null,
		title: "Target",
	});

	it("updates only the source parent and updatedAt after a valid walk", async () => {
		const source = pageRow({ id: "page-1" });
		const fixture = createMovePageService({
			source,
			destination,
			ancestors: [destination],
		});
		const result = await fixture.service.movePage("owner-1", source.id, {
			parentId: destination.id,
			expectedParentId: null,
		});
		expect(result).toMatchObject({ id: source.id, parentId: destination.id });
		expect(source.updatedAt.getTime()).toBeGreaterThan(now.getTime());
		expect(fixture.updateCalls).toBe(1);
	});

	it("returns the source unchanged for the same parent", async () => {
		const source = pageRow({ id: "page-1", parentId: destination.id });
		const before = source.updatedAt;
		const fixture = createMovePageService({
			source,
			destination,
			ancestors: [destination],
		});
		await expect(
			fixture.service.movePage("owner-1", source.id, {
				parentId: destination.id,
				expectedParentId: destination.id,
			}),
		).resolves.toMatchObject({ parentId: destination.id });
		expect(source.updatedAt).toBe(before);
		expect(fixture.updateCalls).toBe(0);
	});

	it("hides missing sources and destinations and returns typed parent conflicts", async () => {
		const missing = createMovePageService({ destination });
		await expect(
			missing.service.movePage("owner-1", "missing", {
				parentId: null,
				expectedParentId: null,
			}),
		).rejects.toMatchObject({ status: 404 });

		const source = pageRow({ id: "page-1" });
		const noDestination = createMovePageService({ source });
		await expect(
			noDestination.service.movePage("owner-1", source.id, {
				parentId: "missing",
				expectedParentId: null,
			}),
		).rejects.toMatchObject({ status: 404 });

		source.parentId = "another-parent";
		const mismatch = createMovePageService({
			source,
			ancestors: [pageRow({ id: "another-parent" })],
		});
		await expect(
			mismatch.service.movePage("owner-1", source.id, {
				parentId: null,
				expectedParentId: null,
			}),
		).rejects.toBeInstanceOf(PageParentConflictError);
	});

	it("rejects self/descendant moves and broken existing or destination chains", async () => {
		const source = pageRow({ id: "page-1" });
		const self = createMovePageService({ source, destination: source });
		await expect(
			self.service.movePage("owner-1", source.id, {
				parentId: source.id,
				expectedParentId: null,
			}),
		).rejects.toBeInstanceOf(InvalidPageHierarchyError);

		const descendant = pageRow({ id: "page-3", parentId: source.id });
		const childTarget = createMovePageService({
			source,
			destination: descendant,
			ancestors: [descendant],
		});
		await expect(
			childTarget.service.movePage("owner-1", source.id, {
				parentId: descendant.id,
				expectedParentId: null,
			}),
		).rejects.toBeInstanceOf(InvalidPageHierarchyError);

		const malformedExisting = createMovePageService({
			source: pageRow({ id: "page-4", parentId: "missing-parent" }),
			ancestors: [undefined],
		});
		await expect(
			malformedExisting.service.movePage("owner-1", "page-4", {
				parentId: null,
				expectedParentId: "missing-parent",
			}),
		).rejects.toMatchObject({ status: 500 });

		const cyclicDestination = pageRow({ id: "page-5", parentId: "page-5" });
		const cycle = createMovePageService({
			source: pageRow({ id: "page-6" }),
			destination: cyclicDestination,
			ancestors: [cyclicDestination, cyclicDestination],
		});
		await expect(
			cycle.service.movePage("owner-1", "page-6", {
				parentId: cyclicDestination.id,
				expectedParentId: null,
			}),
		).rejects.toMatchObject({ status: 500 });
	});

	it("distinguishes update conflicts and internal write failures", async () => {
		const source = pageRow({ id: "page-1" });
		const changed = createMovePageService({
			source,
			destination,
			ancestors: [destination],
			updateFails: true,
			onUpdateFailure: () => {
				source.parentId = "page-3";
			},
		});
		await expect(
			changed.service.movePage("owner-1", source.id, {
				parentId: destination.id,
				expectedParentId: null,
			}),
		).rejects.toMatchObject({ currentParentId: "page-3" });

		const failed = createMovePageService({
			source: pageRow({ id: "page-1" }),
			destination,
			ancestors: [destination],
			updateFails: true,
		});
		await expect(
			failed.service.movePage("owner-1", "page-1", {
				parentId: destination.id,
				expectedParentId: null,
			}),
		).rejects.toMatchObject({ status: 500 });
	});
});

describe("updatePageContent", () => {
	it("returns the saved revision and value", async () => {
		const service = createService({
			page: { id: "page-1" },
			content: { revision: 0 },
			updated: [
				{
					revision: 1,
					valueJson: JSON.stringify(input.value),
				},
			],
		});

		const result = await service.updatePageContent("owner-1", "page-1", input);
		expect(result.content).toEqual({ revision: 1, value: input.value });
		expect(result.page.id).toBe("page-1");
		expect(result.page.updatedAt.getTime()).toBeGreaterThan(0);
	});

	it("rejects missing, conflicting, and failed content updates", async () => {
		const missingPage = createService({});
		await expect(
			missingPage.updatePageContent("owner-1", "page-1", input),
		).rejects.toMatchObject({ status: 404, message: "Not found" });

		const missingContent = createService({ page: { id: "page-1" } });
		await expect(
			missingContent.updatePageContent("owner-1", "page-1", input),
		).rejects.toBeInstanceOf(HttpError);

		const conflict = createService({
			page: { id: "page-1" },
			content: { revision: 2 },
		});
		await expect(
			conflict.updatePageContent("owner-1", "page-1", input),
		).rejects.toBeInstanceOf(ContentRevisionConflictError);

		const emptyUpdate = createService({
			page: { id: "page-1" },
			content: { revision: 0 },
			updated: [],
		});
		await expect(
			emptyUpdate.updatePageContent("owner-1", "page-1", input),
		).rejects.toMatchObject({ status: 500 });

		const blankRow = createService({
			page: { id: "page-1" },
			content: { revision: 0 },
			updated: [undefined],
		});
		await expect(
			blankRow.updatePageContent("owner-1", "page-1", input),
		).rejects.toMatchObject({ status: 500 });

		const staleRevision = createService({
			page: { id: "page-1" },
			content: { revision: 0 },
			updated: [{ revision: 4, valueJson: JSON.stringify(input.value) }],
		});
		await expect(
			staleRevision.updatePageContent("owner-1", "page-1", input),
		).rejects.toMatchObject({ status: 500 });

		const invalidJson = createService({
			page: { id: "page-1" },
			content: { revision: 0 },
			updated: [{ revision: 1, valueJson: "not-json" }],
		});
		await expect(
			invalidJson.updatePageContent("owner-1", "page-1", input),
		).rejects.toMatchObject({ status: 500 });

		const notAnArray = createService({
			page: { id: "page-1" },
			content: { revision: 0 },
			updated: [{ revision: 1, valueJson: JSON.stringify({ text: "nope" }) }],
		});
		await expect(
			notAnArray.updatePageContent("owner-1", "page-1", input),
		).rejects.toBeInstanceOf(HttpError);

		const invalidShape = createService({
			page: { id: "page-1" },
			content: { revision: 0 },
			updated: [{ revision: 1, valueJson: "[]" }],
		});
		await expect(
			invalidShape.updatePageContent("owner-1", "page-1", input),
		).rejects.toMatchObject({ status: 500 });
	});
});

it("validates cyclic existing parents and a missing destination ancestor", async () => {
	const cyclic = pageRow({ id: "parent", parentId: "parent" });
	const existing = createMovePageService({
		source: pageRow({ parentId: "parent" }),
		ancestors: [cyclic, cyclic],
	});
	await expect(
		existing.service.movePage("owner-1", "page-1", {
			parentId: null,
			expectedParentId: "parent",
		}),
	).rejects.toMatchObject({ status: 500 });
	const missing = createMovePageService({
		source: pageRow(),
		destination: pageRow({ id: "parent" }),
		ancestors: [undefined],
	});
	await expect(
		missing.service.movePage("owner-1", "page-1", {
			parentId: "parent",
			expectedParentId: null,
		}),
	).rejects.toMatchObject({ status: 500 });
});
it("moves from an existing parent and treats absent nullable parents as root", async () => {
	const parent = pageRow({ id: "parent" });
	const result = createMovePageService({
		source: pageRow({ parentId: "parent" }),
		ancestors: [parent],
	});
	await expect(
		result.service.movePage("owner-1", "page-1", {
			parentId: null,
			expectedParentId: "parent",
		}),
	).resolves.toMatchObject({ parentId: null });
});

it("rolls back failed page timestamps and rejects unsafe stored revisions", async () => {
	const failed = createService({
		page: { id: "page-1" },
		content: { revision: 0 },
		updated: [{ revision: 1, valueJson: JSON.stringify(input.value) }],
		pageUpdateFails: true,
	});
	await expect(
		failed.updatePageContent("owner-1", "page-1", input),
	).rejects.toMatchObject({ status: 500 });
	const revision = Number.MAX_SAFE_INTEGER;
	const invalid = createService({
		page: { id: "page-1" },
		content: { revision },
		updated: [
			{ revision: revision + 1, valueJson: JSON.stringify(input.value) },
		],
	});
	await expect(
		invalid.updatePageContent("owner-1", "page-1", { ...input, revision }),
	).rejects.toMatchObject({ status: 500 });
});

it("preserves a typed storage failure instead of replacing its status", async () => {
	const failure = new HttpError(503, "Storage unavailable");
	const spy = vi
		.spyOn(pageContentValueSchema, "parse")
		.mockImplementationOnce(() => {
			throw failure;
		});
	const service = createPageService({
		pages: [pageRow()],
		content: { revision: 0, valueJson: JSON.stringify(EMPTY_PAGE_VALUE) },
	});
	try {
		await expect(service.getPage("owner-1", "page-1")).rejects.toBe(failure);
	} finally {
		spy.mockRestore();
	}
});
