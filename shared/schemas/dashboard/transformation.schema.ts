import { z } from "zod";
import {
	DASHBOARD_V2_LIMITS,
	dashboardFrameRefIdSchema,
	dashboardTransformationInstanceIdSchema,
	dashboardVisualizationTypeIdSchema,
} from "./common.schema";
import { dashboardDataShapeSchema } from "./data-frame.schema";
import {
	dashboardJsonObjectSchema,
	validateDashboardJsonValue,
} from "./json-value.schema";

const reserved = [
	"core.reduce",
	"core.rate",
	"core.difference",
	"core.moving-average",
	"core.cumulative-sum",
	"core.group-by",
	"core.sort",
	"core.limit",
	"core.histogram",
	"core.filter-fields",
	"core.filter-rows",
	"core.rename-fields",
	"core.calculate-field",
	"core.join",
	"core.pivot",
	"core.fill-missing",
	"core.time-bucket",
	"core.threshold-to-state",
] as const;
export const RESERVED_TRANSFORMATION_TYPE_IDS = reserved;

export const transformationSpecV2Schema = z
	.object({
		id: dashboardTransformationInstanceIdSchema,
		type: dashboardVisualizationTypeIdSchema,
		disabled: z.boolean().default(false),
		execution: z.enum(["server", "browser"]).default("browser"),
		inputFrameRefs: z
			.array(dashboardFrameRefIdSchema)
			.min(1)
			.max(DASHBOARD_V2_LIMITS.maxFramesPerResponse)
			.refine(
				(values) => new Set(values).size === values.length,
				"inputFrameRefs must be unique",
			),
		outputFrameRefId: dashboardFrameRefIdSchema,
		options: dashboardJsonObjectSchema.default({}),
	})
	.strict()
	.superRefine((value, context) => {
		if (
			!validateDashboardJsonValue(value.options, {
				maxDepth: DASHBOARD_V2_LIMITS.maxJsonDepth,
				maxObjectKeys: DASHBOARD_V2_LIMITS.maxJsonObjectKeys,
				maxArrayItems: DASHBOARD_V2_LIMITS.maxJsonArrayItems,
				maxBytes: DASHBOARD_V2_LIMITS.maxTransformationOptionsBytes,
			}).valid
		)
			context.addIssue({
				code: "custom",
				path: ["options"],
				message: "transformation options exceed JSON budget",
			});
	});
export type TransformationSpecV2 = z.infer<typeof transformationSpecV2Schema>;

export const transformationDescriptorSchema = z
	.object({
		type: dashboardVisualizationTypeIdSchema,
		displayName: z.string().trim().min(1).max(128),
		description: z.string().trim().max(512),
		configSchemaVersion: z.number().int().positive(),
		inputShapes: z.union([
			z.array(dashboardDataShapeSchema),
			z.tuple([z.literal("any")]),
		]),
		outputShape: z.union([
			dashboardDataShapeSchema,
			z.enum(["preserve", "dynamic"]),
		]),
		serverCapable: z.boolean(),
		browserCapable: z.boolean(),
	})
	.strict();
export type TransformationDescriptor = z.infer<
	typeof transformationDescriptorSchema
>;
export type TransformationDefinition<TConfig> = {
	descriptor: TransformationDescriptor;
	configSchema: z.ZodType<TConfig>;
};

export function validateTransformationDefinition<TConfig>(
	spec: TransformationSpecV2,
	definition: TransformationDefinition<TConfig>,
): { valid: true; config: TConfig } | { valid: false; error: string } {
	try {
		const descriptor = transformationDescriptorSchema.parse(
			definition.descriptor,
		);
		if (spec.execution === "server" && !descriptor.serverCapable)
			throw new Error("TRANSFORMATION_SERVER_UNSUPPORTED");
		if (spec.execution === "browser" && !descriptor.browserCapable)
			throw new Error("TRANSFORMATION_BROWSER_UNSUPPORTED");
		if (descriptor.type !== spec.type)
			throw new Error("TRANSFORMATION_TYPE_MISMATCH");
		return { valid: true, config: definition.configSchema.parse(spec.options) };
	} catch (error) {
		return {
			valid: false,
			error: error instanceof Error ? error.message : "invalid transformation",
		};
	}
}
