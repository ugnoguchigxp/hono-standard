import { z } from "zod";

export const DASHBOARD_SCHEMA_VERSION_V1 = 1 as const;
export const DASHBOARD_SCHEMA_VERSION_V2 = 2 as const;

export const DASHBOARD_V2_LIMITS = {
	maxFramesPerResponse: 16,
	maxFieldsPerFrame: 64,
	maxRowsPerFrame: 2_000,
	maxCellsPerFrame: 100_000,
	maxCellsPerResponse: 250_000,
	maxFieldRoles: 4,
	maxFieldLabels: 20,
	maxLabelLength: 128,
	maxCellStringLength: 8_192,
	maxNotices: 50,
	maxTransformationsPerPanel: 20,
	maxOverridesPerPanel: 50,
	maxQueriesPerPanel: 8,
	maxVisualizationOptionsBytes: 32_768,
	maxTransformationOptionsBytes: 16_384,
	maxErrorDetailsBytes: 16_384,
	maxJsonDepth: 8,
	maxJsonObjectKeys: 128,
	maxJsonArrayItems: 2_000,
	maxLinksPerPanel: 10,
	maxThresholdSteps: 20,
	maxValueMappings: 50,
	maxVariableOptions: 1_000,
	maxStaticVariableOptions: 100,
	maxStateLanes: 50,
	maxStateIntervals: 2_000,
	maxStateSamples: 2_000,
	maxStateColumns: 500,
	maxStateCells: 5_000,
	maxUptimeBuckets: 730,
	maxUptimeCells: 5_000,
	maxAnnotationLayers: 8,
	maxAnnotations: 500,
	maxAnnotationCluster: 50,
} as const;

export const dashboardSchemaVersionSchema = z.union([
	z.literal(DASHBOARD_SCHEMA_VERSION_V1),
	z.literal(DASHBOARD_SCHEMA_VERSION_V2),
]);

const id = (pattern: RegExp, max: number) => z.string().regex(pattern).max(max);
const entityId = /^[a-z][a-z0-9-]*$/;
const typeId = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const fieldKey = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
const frameRef = /^[A-Z][A-Z0-9]*$/;

export const dashboardIdSchema = id(entityId, 64);
export const dashboardPanelIdSchemaV2 = id(entityId, 64);
export const dashboardVariableIdSchema = id(entityId, 64);
export const dashboardQueryIdSchema = id(entityId, 64);
export const dashboardTransformationInstanceIdSchema = id(entityId, 64);
export const dashboardVisualizationTypeIdSchema = id(typeId, 80);
export const dashboardPresetIdSchema = id(entityId, 64);
export const dashboardFrameRefIdSchema = id(frameRef, 8);
export const dashboardFieldKeySchema = id(fieldKey, 80);

export const dashboardRangeV2Schema = z.union([
	z
		.object({
			kind: z.literal("relative"),
			value: z.enum(["15m", "1h", "6h", "24h", "7d"]),
		})
		.strict(),
	z
		.object({
			kind: z.literal("absolute"),
			from: z.string().datetime({ offset: true }),
			to: z.string().datetime({ offset: true }),
		})
		.strict()
		.superRefine((value, context) => {
			if (Date.parse(value.from) >= Date.parse(value.to)) {
				context.addIssue({
					code: "custom",
					path: ["from"],
					message: "from must be before to",
				});
			}
		}),
]);
export type DashboardRangeV2 = z.infer<typeof dashboardRangeV2Schema>;

export const dashboardFiltersV2Schema = z
	.record(dashboardIdSchema, z.array(z.string().trim().min(1).max(128)).max(50))
	.refine((value) => Object.keys(value).length <= 20, "too many filters");
export type DashboardFiltersV2 = z.infer<typeof dashboardFiltersV2Schema>;
export const dashboardTimezoneV2Schema = z.string().trim().min(1).max(64);

export const dashboardIdSchemas = {
	dashboardIdSchema,
	dashboardPanelIdSchemaV2,
	dashboardVariableIdSchema,
	dashboardQueryIdSchema,
	dashboardTransformationInstanceIdSchema,
	dashboardVisualizationTypeIdSchema,
	dashboardPresetIdSchema,
	dashboardFrameRefIdSchema,
	dashboardFieldKeySchema,
} as const;
