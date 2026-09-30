import { z } from "zod";
import { pageContentValueSchema } from "./page-content.schema";

export const EMPTY_PAGE_VALUE = [
	{ type: "p", children: [{ text: "" }] },
] as const;

export const pageTitleSchema = z.string().trim().min(1).max(200);

export const createPageInputSchema = z.strictObject({
	title: pageTitleSchema,
	parentId: z.union([z.string().uuid(), z.null()]).optional().default(null),
});
export type CreatePageInput = z.infer<typeof createPageInputSchema>;

export const updatePageTitleInputSchema = z.strictObject({
	title: pageTitleSchema,
});
export type UpdatePageTitleInput = z.infer<typeof updatePageTitleInputSchema>;

export const movePageInputSchema = z.strictObject({
	parentId: z.union([z.string().uuid(), z.null()]),
	expectedParentId: z.union([z.string().uuid(), z.null()]),
});
export type MovePageInput = z.infer<typeof movePageInputSchema>;

export const pageParentConflictResponseSchema = z.strictObject({
	message: z.literal("Page parent conflict"),
	code: z.literal("PAGE_PARENT_CONFLICT"),
	currentParentId: z.union([z.string().uuid(), z.null()]),
});
export type PageParentConflictResponse = z.infer<
	typeof pageParentConflictResponseSchema
>;

export const invalidPageHierarchyResponseSchema = z.strictObject({
	message: z.literal("Invalid page hierarchy"),
	code: z.literal("INVALID_PAGE_HIERARCHY"),
});
export type InvalidPageHierarchyResponse = z.infer<
	typeof invalidPageHierarchyResponseSchema
>;

export const duplicatePageInputSchema = z.strictObject({
	requestId: z.string().uuid(),
	expectedContentRevision: z
		.number()
		.int()
		.nonnegative()
		.max(Number.MAX_SAFE_INTEGER),
	expectedTitle: pageTitleSchema,
	expectedParentId: z.union([z.string().uuid(), z.null()]),
});
export type DuplicatePageInput = z.infer<typeof duplicatePageInputSchema>;

export const sourcePageChangedResponseSchema = z.strictObject({
	message: z.string(),
	code: z.literal("SOURCE_PAGE_CHANGED"),
});
export type SourcePageChangedResponse = z.infer<
	typeof sourcePageChangedResponseSchema
>;

export const duplicateRequestConflictResponseSchema = z.strictObject({
	message: z.string(),
	code: z.literal("DUPLICATE_REQUEST_CONFLICT"),
});
export type DuplicateRequestConflictResponse = z.infer<
	typeof duplicateRequestConflictResponseSchema
>;

export const duplicatedPageUnavailableResponseSchema = z.strictObject({
	message: z.string(),
	code: z.literal("DUPLICATED_PAGE_UNAVAILABLE"),
});
export type DuplicatedPageUnavailableResponse = z.infer<
	typeof duplicatedPageUnavailableResponseSchema
>;

export const pageIdParamSchema = z.object({
	id: z.string().uuid(),
});
export type PageIdParam = z.infer<typeof pageIdParamSchema>;

export const pageSummarySchema = z.object({
	id: z.string().uuid(),
	parentId: z.string().uuid().nullable(),
	title: z.string(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});
export type PageSummary = z.infer<typeof pageSummarySchema>;

export const pageSchema = pageSummarySchema.extend({
	ownerId: z.string().uuid(),
});
export type Page = z.infer<typeof pageSchema>;

export const pageContentSchema = z.object({
	revision: z.number().int().nonnegative(),
	value: pageContentValueSchema,
});
export type PageContent = z.infer<typeof pageContentSchema>;

export const createPageResponseSchema = z.object({
	page: pageSchema,
});
export type CreatePageResponse = z.infer<typeof createPageResponseSchema>;

export const listPagesResponseSchema = z.object({
	pages: z.array(pageSummarySchema),
});
export type ListPagesResponse = z.infer<typeof listPagesResponseSchema>;

export const getPageResponseSchema = z.object({
	page: pageSchema,
	content: pageContentSchema,
});
export type GetPageResponse = z.infer<typeof getPageResponseSchema>;

export const updatePageResponseSchema = z.object({
	page: pageSchema,
});
export type UpdatePageResponse = z.infer<typeof updatePageResponseSchema>;
