import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import {
	contentRevisionConflictResponseSchema,
	type UpdatePageContentResponse,
	updatePageContentInputSchema,
	updatePageContentResponseSchema,
} from "../../shared/schemas/page-content.schema";
import {
	type CreatePageResponse,
	createPageInputSchema,
	createPageResponseSchema,
	duplicatePageInputSchema,
	duplicateRequestConflictResponseSchema,
	duplicatedPageUnavailableResponseSchema,
	type GetPageResponse,
	getPageResponseSchema,
	type ListPagesResponse,
	listPagesResponseSchema,
	invalidPageHierarchyResponseSchema,
	movePageInputSchema,
	pageIdParamSchema,
	pageParentConflictResponseSchema,
	sourcePageChangedResponseSchema,
	type UpdatePageResponse,
	updatePageResponseSchema,
	updatePageTitleInputSchema,
} from "../../shared/schemas/pages.schema";
import { getAuthContextUser } from "../modules/auth/context";
import {
	ContentRevisionConflictError,
	InvalidPageHierarchyError,
	PageParentConflictError,
	DuplicatedContentTooLargeError,
	PageDuplicateError,
	type PagesService,
} from "../modules/pages/pages.service";

const rejectInvalidRequest = (result: { success: boolean }, c: Context) => {
	if (!result.success) {
		return c.json({ message: "Invalid request" }, 400);
	}
};

type PagesRouteDeps = {
	pagesService: PagesService;
};

export function createPagesRoute(deps: PagesRouteDeps) {
	return new Hono()
		.post(
			"/:id/duplicate",
			zValidator("param", pageIdParamSchema, rejectInvalidRequest),
			zValidator("json", duplicatePageInputSchema, rejectInvalidRequest),
			async (c) => {
				const authUser = getAuthContextUser(c);
				const { id } = c.req.valid("param");
				const input = c.req.valid("json");
				try {
					const result = await deps.pagesService.duplicatePage(
						authUser.userId,
						id,
						input,
					);
					const body = createPageResponseSchema.parse({ page: result.page });
					return c.json(body, result.replayed ? 200 : 201);
				} catch (error) {
					if (error instanceof PageDuplicateError) {
						const response =
							error.code === "SOURCE_PAGE_CHANGED"
								? sourcePageChangedResponseSchema.parse({
										message: error.message,
										code: error.code,
									})
								: error.code === "DUPLICATE_REQUEST_CONFLICT"
									? duplicateRequestConflictResponseSchema.parse({
											message: error.message,
											code: error.code,
										})
									: duplicatedPageUnavailableResponseSchema.parse({
											message: error.message,
											code: error.code,
										});
						return c.json(response, 409);
					}
					if (error instanceof DuplicatedContentTooLargeError) {
						return c.json({ message: error.message }, 413);
					}
					throw error;
				}
			},
		)
		.post(
			"/",
			zValidator("json", createPageInputSchema, rejectInvalidRequest),
			async (c) => {
				const authUser = getAuthContextUser(c);
				const body = c.req.valid("json");
				const page = await deps.pagesService.createPage(authUser.userId, body);
				const response = { page } satisfies CreatePageResponse;
				return c.json(createPageResponseSchema.parse(response), 201);
			},
		)
		.get("/", async (c) => {
			const authUser = getAuthContextUser(c);
			const pages = await deps.pagesService.listPages(authUser.userId);
			const response = { pages } satisfies ListPagesResponse;
			return c.json(listPagesResponseSchema.parse(response));
		})
		.get(
			"/:id",
			zValidator("param", pageIdParamSchema, rejectInvalidRequest),
			async (c) => {
				const authUser = getAuthContextUser(c);
				const { id } = c.req.valid("param");
				const result = await deps.pagesService.getPage(authUser.userId, id);
				const response = result satisfies GetPageResponse;
				return c.json(getPageResponseSchema.parse(response));
			},
		)
		.post(
			"/:id/move",
			zValidator("param", pageIdParamSchema, rejectInvalidRequest),
			zValidator("json", movePageInputSchema, rejectInvalidRequest),
			async (c) => {
				const authUser = getAuthContextUser(c);
				const { id } = c.req.valid("param");
				const body = c.req.valid("json");
				try {
					const page = await deps.pagesService.movePage(
						authUser.userId,
						id,
						body,
					);
					return c.json(updatePageResponseSchema.parse({ page }));
				} catch (error) {
					if (error instanceof PageParentConflictError) {
						return c.json(
							pageParentConflictResponseSchema.parse({
								message: "Page parent conflict",
								code: "PAGE_PARENT_CONFLICT",
								currentParentId: error.currentParentId,
							}),
							409,
						);
					}
					if (error instanceof InvalidPageHierarchyError) {
						return c.json(
							invalidPageHierarchyResponseSchema.parse({
								message: "Invalid page hierarchy",
								code: "INVALID_PAGE_HIERARCHY",
							}),
							409,
						);
					}
					throw error;
				}
			},
		)
		.patch(
			"/:id",
			zValidator("param", pageIdParamSchema, rejectInvalidRequest),
			zValidator("json", updatePageTitleInputSchema, rejectInvalidRequest),
			async (c) => {
				const authUser = getAuthContextUser(c);
				const { id } = c.req.valid("param");
				const { title } = c.req.valid("json");
				const page = await deps.pagesService.renamePage(
					authUser.userId,
					id,
					title,
				);
				const response = { page } satisfies UpdatePageResponse;
				return c.json(updatePageResponseSchema.parse(response));
			},
		)
		.put(
			"/:id/content",
			zValidator("param", pageIdParamSchema, rejectInvalidRequest),
			zValidator("json", updatePageContentInputSchema, rejectInvalidRequest),
			async (c) => {
				const authUser = getAuthContextUser(c);
				const { id } = c.req.valid("param");
				const body = c.req.valid("json");
				try {
					const result = await deps.pagesService.updatePageContent(
						authUser.userId,
						id,
						body,
					);
					const response = updatePageContentResponseSchema.parse({
						content: result.content,
						page: {
							id: result.page.id,
							updatedAt: result.page.updatedAt.toISOString(),
						},
					});
					return c.json(response satisfies UpdatePageContentResponse);
				} catch (error) {
					if (error instanceof ContentRevisionConflictError) {
						return c.json(
							contentRevisionConflictResponseSchema.parse({
								message: "Content revision conflict",
								currentRevision: error.currentRevision,
							}),
							409,
						);
					}
					throw error;
				}
			},
		);
}
