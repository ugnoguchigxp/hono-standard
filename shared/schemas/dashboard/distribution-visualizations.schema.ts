import { z } from "zod";
import { dashboardFieldKeySchema } from "./common.schema";
import { dashboardColorTokenSchema } from "./field-config.schema";
import type { DashboardJsonObject } from "./json-value.schema";
import type { VisualizationDefinition } from "./visualization.schema";

const scaleConfig = z
	.object({
		mode: z.enum(["linear", "log", "symlog"]).default("linear"),
		min: z.union([z.literal("auto"), z.number().finite()]).default("auto"),
		max: z.union([z.literal("auto"), z.number().finite()]).default("auto"),
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
		if (value.mode === "log" && typeof value.min === "number" && value.min <= 0)
			context.addIssue({
				code: "custom",
				path: ["min"],
				message: "log scale requires a positive minimum",
			});
		if (value.mode === "log" && typeof value.max === "number" && value.max <= 0)
			context.addIssue({
				code: "custom",
				path: ["max"],
				message: "log scale requires a positive maximum",
			});
	});
export const distributionScaleConfigSchema = scaleConfig;

const colorDomain = z.union([
	z.literal("auto"),
	z
		.object({
			min: z.number().finite(),
			max: z.number().finite(),
			center: z.number().finite().optional(),
		})
		.strict(),
]);
export const distributionColorScaleConfigSchema = z
	.object({
		mode: z.enum(["sequential", "diverging", "status"]).default("sequential"),
		domain: colorDomain.default("auto"),
		steps: z.number().int().min(3).max(9).default(5),
		emptyColorToken: dashboardColorTokenSchema.default("--color-muted"),
	})
	.strict()
	.superRefine((value, context) => {
		if (
			value.mode === "diverging" &&
			value.domain !== "auto" &&
			value.domain.center === undefined
		)
			context.addIssue({
				code: "custom",
				path: ["domain", "center"],
				message: "diverging scale requires a center",
			});
		if (value.domain !== "auto" && value.domain.min >= value.domain.max)
			context.addIssue({
				code: "custom",
				path: ["domain", "min"],
				message: "color domain min must be less than max",
			});
		if (
			value.mode === "diverging" &&
			value.domain !== "auto" &&
			value.domain.center !== undefined &&
			(value.domain.center <= value.domain.min ||
				value.domain.center >= value.domain.max)
		)
			context.addIssue({
				code: "custom",
				path: ["domain", "center"],
				message: "diverging center must be inside the domain",
			});
	});
export type DistributionScaleConfig = z.infer<typeof scaleConfig>;
export type DistributionColorScaleConfig = z.infer<
	typeof distributionColorScaleConfigSchema
>;

export const histogramConfigV1Schema = z
	.object({
		showLegend: z.boolean().default(true),
		showGrid: z.boolean().default(true),
		showBinLabels: z.boolean().default(false),
		orientation: z.enum(["vertical", "horizontal"]).default("vertical"),
		normalization: z.enum(["count", "density", "probability"]).default("count"),
		cumulativeMode: z.enum(["count", "probability"]).default("count"),
		stackMode: z.enum(["none", "stack", "percent"]).default("none"),
		xScale: scaleConfig.default({ mode: "linear", min: "auto", max: "auto" }),
		referenceLines: z
			.array(
				z
					.object({
						value: z.number().finite(),
						label: z.string().trim().max(64).optional(),
						colorToken: dashboardColorTokenSchema.default("--color-muted"),
					})
					.strict(),
			)
			.max(20)
			.default([]),
	})
	.strict();
export type HistogramConfigV1 = z.infer<typeof histogramConfigV1Schema>;

export const heatmapConfigV1Schema = z
	.object({
		xFieldKey: dashboardFieldKeySchema.optional(),
		yFieldKey: dashboardFieldKeySchema.optional(),
		valueFieldKey: dashboardFieldKeySchema.optional(),
		colorScale: distributionColorScaleConfigSchema.default({
			mode: "sequential",
			domain: "auto",
			steps: 5,
			emptyColorToken: "--color-muted",
		}),
		showLegend: z.boolean().default(true),
		showCellValues: z.boolean().default(false),
		cellGap: z.number().finite().min(0).max(16).default(2),
		xSort: z.enum(["input", "asc", "desc"]).default("input"),
		ySort: z.enum(["input", "asc", "desc"]).default("input"),
		missing: z.enum(["gap", "empty-token"]).default("gap"),
	})
	.strict();
export type HeatmapConfigV1 = z.infer<typeof heatmapConfigV1Schema>;

export const boxPlotConfigV1Schema = z
	.object({
		orientation: z.enum(["vertical", "horizontal"]).default("vertical"),
		inputMode: z.enum(["summary", "raw"]).default("summary"),
		showOutliers: z.boolean().default(true),
		showAllPoints: z.boolean().default(false),
		showMean: z.boolean().default(false),
		showGrid: z.boolean().default(true),
		valueScale: scaleConfig.default({
			mode: "linear",
			min: "auto",
			max: "auto",
		}),
		pointJitter: z.number().finite().min(0).max(0.4).default(0.12),
	})
	.strict()
	.superRefine((value, context) => {
		if (value.inputMode === "summary" && value.showMean)
			context.addIssue({
				code: "custom",
				path: ["showMean"],
				message: "mean is only available for raw box plot input",
			});
	});
export type BoxPlotConfigV1 = z.infer<typeof boxPlotConfigV1Schema>;

const calendarRange = z.union([
	z
		.object({
			mode: z.literal("year"),
			year: z.number().int().min(1970).max(9999),
		})
		.strict(),
	z
		.object({
			mode: z.literal("month"),
			year: z.number().int().min(1970).max(9999),
			month: z.number().int().min(1).max(12),
		})
		.strict(),
	z
		.object({
			mode: z.literal("rolling-weeks"),
			weeks: z.number().int().min(4).max(104),
		})
		.strict(),
]);
export const calendarHeatmapConfigV1Schema = z
	.object({
		range: calendarRange.default({ mode: "year", year: 2026 }),
		weekStartsOn: z.enum(["monday", "sunday"]).default("monday"),
		colorScale: distributionColorScaleConfigSchema.default({
			mode: "sequential",
			domain: "auto",
			steps: 5,
			emptyColorToken: "--color-muted",
		}),
		showMonthLabels: z.boolean().default(true),
		showWeekdayLabels: z.boolean().default(true),
		showCellValues: z.boolean().default(false),
		future: z.enum(["hide", "empty"]).default("empty"),
	})
	.strict();
export type CalendarHeatmapConfigV1 = z.infer<
	typeof calendarHeatmapConfigV1Schema
>;

const capabilities = {
	legend: true,
	tooltip: true,
	sharedCrosshair: false,
	zoom: false,
	rangeSelection: false,
	annotations: false,
	fieldOverrides: true,
	tableFallback: true,
	exportImage: false,
	exportData: true,
	mobileSummary: true,
} as const;
const presets = (ids: readonly string[]) =>
	ids.map((id) => ({ id, displayName: id, description: id }));
const defaults = (extra: DashboardJsonObject = {}) => ({ ...extra });

export const coreHistogramVisualizationContract: VisualizationDefinition<HistogramConfigV1> =
	{
		descriptor: {
			type: "core.histogram",
			displayName: "Histogram",
			description: "Distribution histogram",
			category: "distribution",
			configSchemaVersion: 1,
			presets: presets([
				"count",
				"density",
				"cumulative",
				"stacked",
				"horizontal",
			]),
			defaultPreset: "count",
			supportedShapes: ["distribution"],
			minimumSize: { w: 5, h: 4 },
			recommendedSize: { w: 8, h: 5 },
			capabilities,
		},
		configSchema: histogramConfigV1Schema,
		defaultOptionsByPreset: {
			count: defaults(),
			density: defaults({ normalization: "density" }),
			cumulative: defaults({ cumulativeMode: "probability" }),
			stacked: defaults({ stackMode: "stack" }),
			horizontal: defaults({
				orientation: "horizontal",
				showBinLabels: true,
			}),
		},
	};
export const coreHeatmapVisualizationContract: VisualizationDefinition<HeatmapConfigV1> =
	{
		descriptor: {
			type: "core.heatmap",
			displayName: "Heatmap",
			description: "Two-dimensional distribution heatmap",
			category: "distribution",
			configSchemaVersion: 1,
			presets: presets([
				"matrix",
				"time-bucket",
				"density",
				"diverging",
				"annotated",
			]),
			defaultPreset: "matrix",
			supportedShapes: ["matrix", "distribution", "timeseries"],
			minimumSize: { w: 5, h: 4 },
			recommendedSize: { w: 8, h: 5 },
			capabilities,
		},
		configSchema: heatmapConfigV1Schema,
		defaultOptionsByPreset: {
			matrix: defaults(),
			"time-bucket": defaults(),
			density: defaults({
				colorScale: {
					mode: "sequential",
					domain: "auto",
					steps: 5,
					emptyColorToken: "--color-muted",
				},
			}),
			diverging: defaults({
				colorScale: {
					mode: "diverging",
					domain: "auto",
					steps: 5,
					emptyColorToken: "--color-muted",
				},
			}),
			annotated: defaults({ showCellValues: true }),
		},
	};
export const coreBoxPlotVisualizationContract: VisualizationDefinition<BoxPlotConfigV1> =
	{
		descriptor: {
			type: "core.box-plot",
			displayName: "Box Plot",
			description: "Five-number statistical summary",
			category: "distribution",
			configSchemaVersion: 1,
			presets: presets([
				"vertical",
				"horizontal",
				"grouped",
				"box-and-points",
				"range-summary",
			]),
			defaultPreset: "vertical",
			supportedShapes: ["category", "distribution"],
			minimumSize: { w: 5, h: 4 },
			recommendedSize: { w: 8, h: 5 },
			capabilities,
		},
		configSchema: boxPlotConfigV1Schema,
		defaultOptionsByPreset: {
			vertical: defaults(),
			horizontal: defaults({ orientation: "horizontal" }),
			grouped: defaults(),
			"box-and-points": defaults({ inputMode: "raw", showAllPoints: true }),
			"range-summary": defaults({ showOutliers: false }),
		},
	};
export const coreCalendarHeatmapVisualizationContract: VisualizationDefinition<CalendarHeatmapConfigV1> =
	{
		descriptor: {
			type: "core.calendar-heatmap",
			displayName: "Calendar Heatmap",
			description: "Date activity heatmap",
			category: "distribution",
			configSchemaVersion: 1,
			presets: presets([
				"year",
				"month",
				"rolling-weeks",
				"weekday-profile",
				"status-calendar",
			]),
			defaultPreset: "year",
			supportedShapes: ["timeseries", "table", "matrix"],
			minimumSize: { w: 5, h: 4 },
			recommendedSize: { w: 10, h: 5 },
			capabilities,
		},
		configSchema: calendarHeatmapConfigV1Schema,
		defaultOptionsByPreset: {
			year: defaults(),
			month: defaults({ range: { mode: "month", year: 2026, month: 1 } }),
			"rolling-weeks": defaults({
				range: { mode: "rolling-weeks", weeks: 16 },
			}),
			"weekday-profile": defaults({
				range: { mode: "rolling-weeks", weeks: 52 },
			}),
			"status-calendar": defaults({
				colorScale: {
					mode: "status",
					domain: "auto",
					steps: 4,
					emptyColorToken: "--color-muted",
				},
			}),
		},
	};
