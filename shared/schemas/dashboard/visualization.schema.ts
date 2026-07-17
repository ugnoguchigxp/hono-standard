import { z } from "zod";
import {
	DASHBOARD_V2_LIMITS,
	dashboardPresetIdSchema,
	dashboardVisualizationTypeIdSchema,
} from "./common.schema";
import { dashboardDataShapeSchema } from "./data-frame.schema";
import {
	dashboardJsonObjectSchema,
	mergeDashboardJsonObjects,
	type DashboardJsonObject,
} from "./json-value.schema";
import {
	fieldOverrideV2Schema,
	standardFieldConfigV2Schema,
} from "./field-config.schema";
import { normalizeCartesianOptionsV1 } from "./cartesian-visualizations.schema";
import { annotationLayerSpecsSchema } from "./annotation.schema";

export const RESERVED_VISUALIZATION_TYPE_IDS = [
	"core.timeseries",
	"core.bar",
	"core.composed",
	"core.stat",
	"core.gauge",
	"core.bar-gauge",
	"core.bullet",
	"core.progress",
	"core.traffic-light",
	"core.histogram",
	"core.heatmap",
	"core.box-plot",
	"core.scatter",
	"core.pie",
	"core.radar",
	"core.radial-bar",
	"core.funnel",
	"core.treemap",
	"core.sunburst",
	"core.sankey",
	"core.state-timeline",
	"core.status-history",
	"core.calendar-heatmap",
	"core.uptime-grid",
	"core.node-graph",
	"core.candlestick",
	"core.table",
	"core.pivot-table",
	"core.key-value",
	"observability.logs",
	"observability.trace-waterfall",
	"observability.flame-graph",
	"geo.map",
] as const;

const unique = (values: string[]) => new Set(values).size === values.length;
export const visualizationSpecV2Schema = z
	.object({
		type: dashboardVisualizationTypeIdSchema,
		preset: dashboardPresetIdSchema.optional(),
		frameRefs: z
			.array(
				z
					.string()
					.regex(/^[A-Z][A-Z0-9]*$/)
					.max(8),
			)
			.min(1)
			.max(DASHBOARD_V2_LIMITS.maxFramesPerResponse)
			.refine(unique, "frameRefs must be unique"),
		options: dashboardJsonObjectSchema.default({}),
		fieldConfig: standardFieldConfigV2Schema.default(
			standardFieldConfigV2Schema.parse({}),
		),
		overrides: z
			.array(fieldOverrideV2Schema)
			.max(DASHBOARD_V2_LIMITS.maxOverridesPerPanel)
			.default([]),
		annotationLayers: z.preprocess(
			(value) => value ?? [],
			annotationLayerSpecsSchema.optional(),
		),
		tableFallback: z
			.object({
				enabled: z.boolean().default(true),
				defaultView: z
					.enum(["visualization", "table"])
					.default("visualization"),
			})
			.strict()
			.default({ enabled: true, defaultView: "visualization" }),
	})
	.strict()
	.superRefine((value, context) => {
		if (
			(value.annotationLayers ?? []).length > 0 &&
			value.type === "core.table"
		)
			context.addIssue({
				code: "custom",
				path: ["annotationLayers"],
				message: "Table visualizations do not support annotation layers",
			});
	});
export type VisualizationSpecV2 = z.infer<typeof visualizationSpecV2Schema>;

export const visualizationPresetDescriptorSchema = z
	.object({
		id: dashboardPresetIdSchema,
		displayName: z.string().trim().min(1).max(128),
		description: z.string().trim().max(512),
	})
	.strict();
export const visualizationCapabilitiesSchema = z
	.object({
		legend: z.boolean(),
		tooltip: z.boolean(),
		sharedCrosshair: z.boolean(),
		zoom: z.boolean(),
		rangeSelection: z.boolean(),
		annotations: z.boolean(),
		fieldOverrides: z.boolean(),
		tableFallback: z.boolean(),
		exportImage: z.boolean(),
		exportData: z.boolean(),
		mobileSummary: z.boolean(),
	})
	.strict();
export const visualizationDescriptorSchema = z
	.object({
		type: dashboardVisualizationTypeIdSchema,
		displayName: z.string().trim().min(1).max(128),
		description: z.string().trim().max(512),
		category: z.enum([
			"time",
			"category",
			"distribution",
			"relationship",
			"kpi",
			"status",
			"hierarchy",
			"flow",
			"observability",
			"data",
		]),
		configSchemaVersion: z.number().int().positive(),
		presets: z.array(visualizationPresetDescriptorSchema).min(1),
		defaultPreset: dashboardPresetIdSchema,
		supportedShapes: z.array(dashboardDataShapeSchema).min(1),
		minimumSize: z
			.object({
				w: z.number().int().positive(),
				h: z.number().int().positive(),
			})
			.strict(),
		recommendedSize: z
			.object({
				w: z.number().int().positive(),
				h: z.number().int().positive(),
			})
			.strict(),
		capabilities: visualizationCapabilitiesSchema,
	})
	.strict()
	.superRefine((value, context) => {
		const ids = value.presets.map((preset) => preset.id);
		if (!unique(ids))
			context.addIssue({
				code: "custom",
				path: ["presets"],
				message: "preset IDs must be unique",
			});
		if (!ids.includes(value.defaultPreset))
			context.addIssue({
				code: "custom",
				path: ["defaultPreset"],
				message: "default preset must exist",
			});
	});
export type VisualizationPresetDescriptor = z.infer<
	typeof visualizationPresetDescriptorSchema
>;
export type VisualizationCapabilities = z.infer<
	typeof visualizationCapabilitiesSchema
>;
export type VisualizationDescriptor = z.infer<
	typeof visualizationDescriptorSchema
>;
export type VisualizationDefinition<TConfig> = {
	descriptor: VisualizationDescriptor;
	configSchema: z.ZodType<TConfig>;
	defaultOptionsByPreset: Record<string, DashboardJsonObject>;
};

export function resolveVisualizationConfig<TConfig>(
	spec: VisualizationSpecV2,
	definition: VisualizationDefinition<TConfig>,
): TConfig {
	const descriptor = visualizationDescriptorSchema.parse(definition.descriptor);
	if (descriptor.type !== spec.type)
		throw new Error("VISUALIZATION_TYPE_MISMATCH");
	const preset = spec.preset ?? descriptor.defaultPreset;
	const base = definition.defaultOptionsByPreset[preset];
	if (!base || !descriptor.presets.some((item) => item.id === preset))
		throw new Error("VISUALIZATION_PRESET_INVALID");
	const keys = Object.keys(definition.defaultOptionsByPreset);
	if (keys.some((key) => !descriptor.presets.some((item) => item.id === key)))
		throw new Error("VISUALIZATION_PRESET_INVALID");
	const inputOptions = ["core.timeseries", "core.bar"].includes(descriptor.type)
		? normalizeCartesianOptionsV1(spec.options)
		: spec.options;
	return definition.configSchema.parse(
		mergeDashboardJsonObjects(base, inputOptions),
	);
}

export function validateVisualizationDefinition<TConfig>(
	spec: VisualizationSpecV2,
	definition: VisualizationDefinition<TConfig>,
): { valid: true; config: TConfig } | { valid: false; error: string } {
	try {
		return {
			valid: true,
			config: resolveVisualizationConfig(spec, definition),
		};
	} catch (error) {
		return {
			valid: false,
			error: error instanceof Error ? error.message : "invalid visualization",
		};
	}
}
