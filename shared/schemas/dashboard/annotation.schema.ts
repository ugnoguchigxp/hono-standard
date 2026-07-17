import { z } from "zod";
import {
	DASHBOARD_V2_LIMITS,
	dashboardFrameRefIdSchema,
} from "./common.schema";
import { dashboardColorTokenSchema } from "./field-config.schema";

export const annotationModeSchema = z.enum([
	"point",
	"line",
	"region",
	"badge",
]);
export type AnnotationMode = z.infer<typeof annotationModeSchema>;

export const annotationLayerSpecV1Schema = z
	.object({
		id: z
			.string()
			.regex(/^[a-z][a-z0-9-]*$/)
			.max(64),
		frameRef: dashboardFrameRefIdSchema,
		mode: annotationModeSchema,
		enabled: z.boolean().default(true),
		name: z.string().trim().min(1).max(128),
		colorToken: dashboardColorTokenSchema.optional(),
		severityFilter: z
			.array(z.string().trim().min(1).max(64))
			.max(20)
			.default([]),
		showLabel: z.enum(["always", "hover", "never"]).default("always"),
	})
	.strict()
	.superRefine((value, context) => {
		if (new Set(value.severityFilter).size !== value.severityFilter.length)
			context.addIssue({
				code: "custom",
				path: ["severityFilter"],
				message: "severityFilter must not contain duplicates",
			});
	});
export type AnnotationLayerSpecV1 = z.infer<typeof annotationLayerSpecV1Schema>;

export const annotationLayerSpecsSchema = z
	.array(annotationLayerSpecV1Schema)
	.max(DASHBOARD_V2_LIMITS.maxAnnotationLayers)
	.superRefine((layers, context) => {
		if (new Set(layers.map((layer) => layer.id)).size !== layers.length)
			context.addIssue({
				code: "custom",
				message: "annotation layer IDs must be unique",
			});
	});
