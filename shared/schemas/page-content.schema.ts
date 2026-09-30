import { z } from "zod";

const MAX_BLOCKS = 1000;
const MAX_CHILDREN = 200;
const MAX_TEXT_LENGTH = 100_000;
const MAX_VALUE_BYTES = 1024 * 1024;
/** Saving increments revision, so the request must stay one below the safe integer limit. */
const MAX_REQUEST_REVISION = Number.MAX_SAFE_INTEGER - 1;

function jsonUtf8ByteLength(value: unknown): number {
	return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

/** Plate core `NodeIdPlugin` assigns `nanoid(10)` to each block. */
const plateBlockIdSchema = z.string().regex(/^[A-Za-z0-9_-]{10}$/);

export const pageContentTextSchema = z.strictObject({
	text: z.string().max(MAX_TEXT_LENGTH),
	bold: z.boolean().optional(),
	italic: z.boolean().optional(),
});
export type PageContentText = z.infer<typeof pageContentTextSchema>;

export const pageContentBlockSchema = z.strictObject({
	type: z.enum(["p", "h1", "h2"]),
	id: plateBlockIdSchema.optional(),
	children: z.array(pageContentTextSchema).min(1).max(MAX_CHILDREN),
});
export type PageContentBlock = z.infer<typeof pageContentBlockSchema>;

export const pageContentValueSchema = z
	.array(pageContentBlockSchema)
	.min(1)
	.max(MAX_BLOCKS);
export type PageContentValue = z.infer<typeof pageContentValueSchema>;

export const updatePageContentInputSchema = z
	.strictObject({
		revision: z.number().int().nonnegative().max(MAX_REQUEST_REVISION),
		value: pageContentValueSchema,
	})
	.superRefine((input, ctx) => {
		const bytes = jsonUtf8ByteLength(input.value);
		if (bytes > MAX_VALUE_BYTES) {
			ctx.addIssue({
				code: "custom",
				message: "Page content exceeds 1 MiB",
				path: ["value"],
			});
		}
	});
export type UpdatePageContentInput = z.infer<
	typeof updatePageContentInputSchema
>;

export const savedPageContentSchema = z.object({
	revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	value: pageContentValueSchema,
});
export type SavedPageContent = z.infer<typeof savedPageContentSchema>;

export const updatePageContentResponseSchema = z.object({
	content: savedPageContentSchema,
	page: z.object({
		id: z.string().uuid(),
		updatedAt: z.iso.datetime(),
	}),
});
export type UpdatePageContentResponse = z.infer<
	typeof updatePageContentResponseSchema
>;

export const contentRevisionConflictResponseSchema = z.object({
	message: z.literal("Content revision conflict"),
	currentRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export type ContentRevisionConflictResponse = z.infer<
	typeof contentRevisionConflictResponseSchema
>;
