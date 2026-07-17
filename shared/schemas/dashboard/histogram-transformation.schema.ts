import { z } from "zod";
import { dashboardFieldKeySchema } from "./common.schema";
import type { TransformationDefinition } from "./transformation.schema";

const binning = z.discriminatedUnion("mode", [
	z
		.object({
			mode: z.literal("fixed-count"),
			count: z.number().int().min(2).max(100),
		})
		.strict(),
	z
		.object({
			mode: z.literal("fixed-width"),
			width: z.number().finite().positive(),
			origin: z.number().finite().optional(),
		})
		.strict(),
	z.object({ mode: z.literal("sturges") }).strict(),
	z
		.object({
			mode: z.literal("freedman-diaconis"),
			fallbackCount: z.number().int().min(2).max(100),
		})
		.strict(),
]);
export const histogramTransformationConfigV1Schema = z
	.object({
		valueFieldKey: dashboardFieldKeySchema.optional(),
		seriesFieldKey: dashboardFieldKeySchema.optional(),
		binning: binning.default({ mode: "sturges" }),
		range: z
			.union([
				z.literal("data"),
				z
					.object({ min: z.number().finite(), max: z.number().finite() })
					.strict(),
			])
			.default("data"),
		includeOutOfRange: z.boolean().default(false),
	})
	.strict()
	.superRefine((value, context) => {
		if (typeof value.range !== "string" && value.range.min >= value.range.max)
			context.addIssue({
				code: "custom",
				path: ["range"],
				message: "range min must be less than max",
			});
	});
export type HistogramTransformationConfigV1 = z.infer<
	typeof histogramTransformationConfigV1Schema
>;

export const coreHistogramTransformationContract: TransformationDefinition<HistogramTransformationConfigV1> =
	{
		descriptor: {
			type: "core.histogram",
			displayName: "Histogram",
			description: "Deterministic browser histogram binning",
			configSchemaVersion: 1,
			inputShapes: ["distribution"],
			outputShape: "distribution",
			serverCapable: false,
			browserCapable: true,
		},
		configSchema: histogramTransformationConfigV1Schema,
	};
