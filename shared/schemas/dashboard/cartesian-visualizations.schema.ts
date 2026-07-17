import { z } from "zod";
import { dashboardColorTokenSchema } from "./field-config.schema";
import type { DashboardJsonObject } from "./json-value.schema";
import type { VisualizationDefinition } from "./visualization.schema";

export const cartesianValueAxisSchema = z
	.object({
		scale: z.enum(["linear", "log"]).default("linear"),
		min: z.union([z.literal("auto"), z.number().finite()]).default("auto"),
		max: z.union([z.literal("auto"), z.number().finite()]).default("auto"),
		show: z.boolean().default(true),
	})
	.strict()
	.superRefine((value, context) => {
		if (
			typeof value.min === "number" &&
			typeof value.max === "number" &&
			value.min >= value.max
		)
			context.addIssue({
				code: "custom",
				path: ["min"],
				message: "min must be less than max",
			});
		if (value.scale === "log" && value.min !== "auto" && value.min <= 0)
			context.addIssue({
				code: "custom",
				path: ["min"],
				message: "log scale requires a positive minimum",
			});
	});

export const cartesianReferenceLineSchema = z
	.object({
		value: z.number().finite(),
		label: z.string().trim().max(64).optional(),
		colorToken: dashboardColorTokenSchema.default("--color-muted"),
		lineStyle: z.enum(["solid", "dashed", "dotted"]).default("dashed"),
	})
	.strict();

const commonCartesianOptions = {
	showLegend: z.boolean().default(true),
	showGrid: z.boolean().default(true),
	valueAxis: cartesianValueAxisSchema.default({
		scale: "linear",
		min: "auto",
		max: "auto",
		show: true,
	}),
	referenceLines: z.array(cartesianReferenceLineSchema).max(20).default([]),
};

export const timeseriesConfigV2Schema = z
	.object({
		...commonCartesianOptions,
		connectNulls: z.boolean().default(false),
		lineWidth: z.number().int().min(1).max(6).default(2),
		areaOpacity: z.number().min(0.05).max(1).default(0.24),
		showPoints: z.enum(["auto", "always", "never"]).default("auto"),
		rangeBand: z
			.object({
				lowerFieldKey: z.string().min(1).max(80),
				upperFieldKey: z.string().min(1).max(80),
			})
			.strict()
			.optional(),
		sparklineShowLastValue: z.boolean().default(false),
	})
	.strict()
	.superRefine((value, context) => {
		if (
			value.rangeBand &&
			value.rangeBand.lowerFieldKey === value.rangeBand.upperFieldKey
		)
			context.addIssue({
				code: "custom",
				path: ["rangeBand", "upperFieldKey"],
				message: "range band fields must be distinct",
			});
		if (
			value.valueAxis.scale === "log" &&
			(value.rangeBand !== undefined || value.sparklineShowLastValue)
		)
			context.addIssue({
				code: "custom",
				path: ["valueAxis", "scale"],
				message: "log scale is incompatible with range band or sparkline mode",
			});
	});

export const barConfigV2Schema = z
	.object({
		...commonCartesianOptions,
		categoryLabelAngle: z
			.union([z.literal(0), z.literal(-30), z.literal(-45), z.literal(-90)])
			.default(0),
		barGap: z.number().int().min(0).max(24).default(4),
		categoryGap: z.number().int().min(0).max(48).default(16),
		maxBarSize: z
			.union([z.literal("auto"), z.number().int().min(4).max(120)])
			.default("auto"),
		lollipopDotSize: z.number().int().min(3).max(16).default(6),
		waterfall: z
			.object({
				valueFieldKey: z.string().min(1).max(80).optional(),
				showTotal: z.boolean().default(true),
				totalLabel: z.string().trim().min(1).max(32).default("Total"),
			})
			.strict()
			.default({ showTotal: true, totalLabel: "Total" }),
	})
	.strict();

const composedSeriesSchema = z
	.object({
		fieldKey: z.string().min(1).max(80),
		mark: z.enum(["bar", "line"]),
		axis: z.enum(["left", "right"]),
		lineStyle: z.enum(["linear", "monotone", "stepAfter"]).default("linear"),
	})
	.strict();

export const composedConfigV1Schema = z
	.object({
		showLegend: z.boolean().default(true),
		showGrid: z.boolean().default(true),
		leftAxis: cartesianValueAxisSchema.default({
			scale: "linear",
			min: "auto",
			max: "auto",
			show: true,
		}),
		rightAxis: cartesianValueAxisSchema.default({
			scale: "linear",
			min: "auto",
			max: "auto",
			show: true,
		}),
		referenceLines: z
			.array(
				cartesianReferenceLineSchema.extend({
					axis: z.enum(["left", "right"]),
				}),
			)
			.max(20)
			.default([]),
		series: z.array(composedSeriesSchema).max(16).default([]),
	})
	.strict()
	.superRefine((value, context) => {
		const keys = value.series.map((item) => item.fieldKey);
		if (new Set(keys).size !== keys.length)
			context.addIssue({
				code: "custom",
				path: ["series"],
				message: "series field keys must be unique",
			});
		if (
			value.series.length > 0 &&
			new Set(value.series.map((item) => item.axis)).size < 2
		)
			context.addIssue({
				code: "custom",
				path: ["series"],
				message: "both axes must have a series",
			});
	});

export type TimeseriesConfigV2 = z.infer<typeof timeseriesConfigV2Schema>;
export type BarConfigV2 = z.infer<typeof barConfigV2Schema>;
export type ComposedConfigV1 = z.infer<typeof composedConfigV1Schema>;
export type CartesianValueAxis = z.infer<typeof cartesianValueAxisSchema>;
export type CartesianReferenceLine = z.infer<
	typeof cartesianReferenceLineSchema
>;

const capabilities = {
	legend: true,
	tooltip: true,
	sharedCrosshair: true,
	zoom: false,
	rangeSelection: false,
	annotations: true,
	fieldOverrides: true,
	tableFallback: true,
	exportImage: false,
	exportData: true,
	mobileSummary: true,
} as const;

const timeseriesPresetIds = [
	"line",
	"smooth-line",
	"step-line",
	"area",
	"stacked-area",
	"percent-stacked-area",
	"range-band",
	"sparkline",
] as const;
const barPresetIds = [
	"vertical",
	"horizontal",
	"grouped",
	"stacked",
	"percent-stacked",
	"time-bars",
	"stacked-time-bars",
	"lollipop",
	"waterfall",
] as const;

const presets = (ids: readonly string[]) =>
	ids.map((id) => ({ id, displayName: id, description: id }));
const timeDefaults = (
	overrides: DashboardJsonObject = {},
): DashboardJsonObject => ({
	showLegend: true,
	showGrid: true,
	connectNulls: false,
	lineWidth: 2,
	areaOpacity: 0.24,
	showPoints: "auto",
	valueAxis: { scale: "linear", min: "auto", max: "auto", show: true },
	referenceLines: [],
	sparklineShowLastValue: false,
	...overrides,
});
const barDefaults = (
	overrides: DashboardJsonObject = {},
): DashboardJsonObject => ({
	showLegend: true,
	showGrid: true,
	valueAxis: { scale: "linear", min: "auto", max: "auto", show: true },
	referenceLines: [],
	categoryLabelAngle: 0,
	barGap: 4,
	categoryGap: 16,
	maxBarSize: "auto",
	lollipopDotSize: 6,
	waterfall: { showTotal: true, totalLabel: "Total" },
	...overrides,
});

export const coreTimeseriesVisualizationContract: VisualizationDefinition<TimeseriesConfigV2> =
	{
		descriptor: {
			type: "core.timeseries",
			displayName: "Time series",
			description: "Cartesian time series visualization",
			category: "time",
			configSchemaVersion: 2,
			presets: presets(timeseriesPresetIds),
			defaultPreset: "line",
			supportedShapes: ["timeseries"],
			minimumSize: { w: 2, h: 2 },
			recommendedSize: { w: 8, h: 5 },
			capabilities,
		},
		configSchema: timeseriesConfigV2Schema,
		defaultOptionsByPreset: Object.fromEntries(
			timeseriesPresetIds.map((id) => [
				id,
				timeDefaults(
					id === "sparkline"
						? {
								showLegend: false,
								showGrid: false,
								sparklineShowLastValue: true,
							}
						: id === "range-band"
							? {
									rangeBand: { lowerFieldKey: "lower", upperFieldKey: "upper" },
								}
							: {},
				),
			]),
		),
	};

export const coreBarVisualizationContract: VisualizationDefinition<BarConfigV2> =
	{
		descriptor: {
			type: "core.bar",
			displayName: "Bar",
			description: "Cartesian category and time bar visualization",
			category: "category",
			configSchemaVersion: 2,
			presets: presets(barPresetIds),
			defaultPreset: "vertical",
			supportedShapes: ["category", "timeseries"],
			minimumSize: { w: 4, h: 4 },
			recommendedSize: { w: 8, h: 5 },
			capabilities: { ...capabilities, sharedCrosshair: false },
		},
		configSchema: barConfigV2Schema,
		defaultOptionsByPreset: Object.fromEntries(
			barPresetIds.map((id) => [id, barDefaults()]),
		),
	};

export const coreComposedVisualizationContract: VisualizationDefinition<ComposedConfigV1> =
	{
		descriptor: {
			type: "core.composed",
			displayName: "Dual-axis",
			description: "Composed bar and line dual-axis visualization",
			category: "time",
			configSchemaVersion: 1,
			presets: [
				{
					id: "dual-axis",
					displayName: "Dual axis",
					description: "Bar and line on two axes",
				},
			],
			defaultPreset: "dual-axis",
			supportedShapes: ["timeseries", "category"],
			minimumSize: { w: 6, h: 4 },
			recommendedSize: { w: 10, h: 5 },
			capabilities,
		},
		configSchema: composedConfigV1Schema,
		defaultOptionsByPreset: {
			"dual-axis": {
				showLegend: true,
				showGrid: true,
				leftAxis: { scale: "linear", min: "auto", max: "auto", show: true },
				rightAxis: { scale: "linear", min: "auto", max: "auto", show: true },
				referenceLines: [],
				series: [],
			},
		},
	};

export function normalizeCartesianOptionsV1(
	input: Record<string, unknown>,
): DashboardJsonObject {
	const copy = structuredClone(input) as Record<string, unknown>;
	const valueAxis = (copy.valueAxis ?? {}) as Record<string, unknown>;
	for (const [alias, key] of [
		["yAxisScale", "scale"],
		["yAxisMin", "min"],
		["yAxisMax", "max"],
	] as const) {
		if (
			copy[alias] !== undefined &&
			valueAxis[key] !== undefined &&
			copy[alias] !== valueAxis[key]
		)
			throw new Error(`conflicting Cartesian option: ${alias}`);
		if (copy[alias] !== undefined) valueAxis[key] = copy[alias];
		delete copy[alias];
	}
	if (Object.keys(valueAxis).length > 0) copy.valueAxis = valueAxis;
	delete copy.mode;
	delete copy.orientation;
	delete copy.fill;
	return copy as DashboardJsonObject;
}
