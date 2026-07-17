import { z } from "zod";
import {
	dashboardFieldKeySchema,
	type dashboardPresetIdSchema,
} from "./common.schema";

export const kpiValueBindingSchema = z
	.object({
		valueFieldKey: dashboardFieldKeySchema.optional(),
		previousFieldKey: dashboardFieldKeySchema.optional(),
		deltaFieldKey: dashboardFieldKeySchema.optional(),
		goalFieldKey: dashboardFieldKeySchema.optional(),
	})
	.strict();
export type KpiValueBinding = z.infer<typeof kpiValueBindingSchema>;

export const kpiRangeConfigSchema = z
	.object({
		min: z.enum(["field", "config", "auto"]).default("auto"),
		max: z.enum(["field", "config", "auto"]).default("auto"),
		overflow: z.enum(["reject", "show-marker"]).default("show-marker"),
	})
	.strict();
export type KpiRangeConfig = z.infer<typeof kpiRangeConfigSchema>;

export const deltaConfigSchema = z
	.object({
		mode: z.enum(["absolute", "percent", "percent-points"]).default("absolute"),
		sentiment: z
			.enum(["neutral", "higher-is-better", "lower-is-better"])
			.default("neutral"),
		zeroTolerance: z.number().finite().min(0).default(0),
	})
	.strict();
export type DeltaConfig = z.infer<typeof deltaConfigSchema>;

const statConfigBase = kpiValueBindingSchema.extend({
	reduce: z.enum(["last-not-null", "last"]).default("last-not-null"),
	delta: deltaConfigSchema.default({
		mode: "absolute",
		sentiment: "neutral",
		zeroTolerance: 0,
	}),
	sparkline: z
		.object({
			maxPoints: z.number().int().min(2).max(100).default(100),
			showFill: z.boolean().default(false),
			showMinMax: z.boolean().default(false),
		})
		.strict()
		.default({ maxPoints: 100, showFill: false, showMinMax: false }),
	list: z
		.object({
			orientation: z.enum(["auto", "rows", "grid"]).default("auto"),
			maxItems: z.number().int().min(2).max(12).default(12),
		})
		.strict()
		.default({ orientation: "auto", maxItems: 12 }),
});
export const statConfigV2Schema = statConfigBase
	.extend({
		showLegend: z.boolean().optional(),
		fill: z.string().optional(),
		connectNulls: z.boolean().optional(),
		yAxisScale: z.string().optional(),
		yAxisMin: z.union([z.literal("auto"), z.number()]).optional(),
		yAxisMax: z.union([z.literal("auto"), z.number()]).optional(),
		referenceLines: z.array(z.unknown()).optional(),
	})
	.strict();
export type StatConfigV2 = z.infer<typeof statConfigV2Schema>;

export const gaugeConfigSchema = kpiValueBindingSchema
	.extend({
		range: kpiRangeConfigSchema.default({
			min: "auto",
			max: "auto",
			overflow: "show-marker",
		}),
		startAngle: z.number().finite().min(-360).max(360).default(-180),
		endAngle: z.number().finite().min(-360).max(360).default(0),
		showThresholdBands: z.boolean().default(true),
		showTicks: z.boolean().default(true),
		tickCount: z.number().int().min(2).max(11).default(5),
		showGoal: z.boolean().default(true),
	})
	.strict();
export type GaugeConfig = z.infer<typeof gaugeConfigSchema>;

export const barGaugeConfigSchema = kpiValueBindingSchema
	.extend({
		range: kpiRangeConfigSchema.default({
			min: "auto",
			max: "auto",
			overflow: "show-marker",
		}),
		showUnfilled: z.boolean().default(true),
		showGoal: z.boolean().default(true),
		segmentCount: z.number().int().min(3).max(40).default(10),
		itemSort: z.enum(["input", "value-asc", "value-desc"]).default("input"),
	})
	.strict();
export type BarGaugeConfig = z.infer<typeof barGaugeConfigSchema>;

export const bulletConfigSchema = kpiValueBindingSchema
	.extend({
		range: kpiRangeConfigSchema.default({
			min: "auto",
			max: "auto",
			overflow: "show-marker",
		}),
		showGoalLabel: z.boolean().default(true),
		showValueLabel: z.boolean().default(true),
		showThresholdBands: z.boolean().default(true),
		itemSort: z.enum(["input", "value-asc", "value-desc"]).default("input"),
	})
	.strict();
export type BulletConfig = z.infer<typeof bulletConfigSchema>;

export const progressConfigSchema = kpiValueBindingSchema
	.extend({
		range: kpiRangeConfigSchema.default({
			min: "auto",
			max: "auto",
			overflow: "show-marker",
		}),
		showPercentage: z.boolean().default(true),
		showRemaining: z.boolean().default(true),
		segmentCount: z.number().int().min(3).max(40).default(10),
		currentStepFieldKey: dashboardFieldKeySchema.optional(),
		completedStateValues: z
			.array(z.string().trim().min(1).max(64))
			.max(10)
			.default(["completed"]),
	})
	.strict();
export type ProgressConfig = z.infer<typeof progressConfigSchema>;

export const trafficLightConfigSchema = kpiValueBindingSchema
	.extend({
		stateSource: z.enum(["threshold", "value-mapping"]).default("threshold"),
		layout: z.enum(["auto", "rows", "grid"]).default("auto"),
		shape: z.enum(["circle", "rounded-square"]).default("circle"),
		showInactiveStates: z.boolean().default(true),
		stateOrder: z
			.array(z.enum(["healthy", "warning", "critical", "unknown"]))
			.min(1)
			.max(4)
			.default(["healthy", "warning", "critical", "unknown"]),
	})
	.strict();
export type TrafficLightConfig = z.infer<typeof trafficLightConfigSchema>;

export const kpiPresetDescriptors = {
	"core.stat": [
		"value",
		"value-delta",
		"value-sparkline",
		"value-delta-sparkline",
		"value-list",
	],
	"core.gauge": ["semi-circle", "full-circle", "needle"],
	"core.bar-gauge": ["horizontal", "vertical", "segmented", "retro-lcd"],
	"core.bullet": ["horizontal", "vertical", "comparative"],
	"core.progress": ["linear", "segmented", "steps"],
	"core.traffic-light": ["single", "list", "matrix"],
} as const satisfies Record<
	string,
	readonly z.infer<typeof dashboardPresetIdSchema>[]
>;

export type KpiVisualizationType = keyof typeof kpiPresetDescriptors;
export type KpiPreset =
	(typeof kpiPresetDescriptors)[KpiVisualizationType][number];

export const kpiConfigSchemas = {
	"core.stat": statConfigV2Schema,
	"core.gauge": gaugeConfigSchema,
	"core.bar-gauge": barGaugeConfigSchema,
	"core.bullet": bulletConfigSchema,
	"core.progress": progressConfigSchema,
	"core.traffic-light": trafficLightConfigSchema,
} as const;

export const kpiConfigDefaults = Object.fromEntries(
	Object.entries(kpiPresetDescriptors).map(([type, presets]) => [
		type,
		Object.fromEntries(presets.map((preset) => [preset, {}])),
	]),
);
