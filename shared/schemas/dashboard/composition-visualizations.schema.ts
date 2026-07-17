import { z } from "zod";
import type { DashboardJsonObject } from "./json-value.schema";
import type { VisualizationDefinition } from "./visualization.schema";

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

const pieIds = ["pie", "donut", "semi-donut", "rose"] as const;
const radarIds = ["line", "filled", "multi"] as const;
const radialIds = ["ranking", "progress"] as const;
const funnelIds = ["funnel", "pyramid"] as const;

export const pieConfigV1Schema = z
	.object({
		showLegend: z.boolean().default(true),
		showLabels: z.enum(["auto", "always", "never"]).default("auto"),
		labelContent: z.enum(["category", "percent", "value"]).default("percent"),
		paddingAngle: z.number().finite().min(0).max(10).default(1),
		cornerRadius: z.number().finite().min(0).max(20).default(0),
		sort: z.enum(["none", "ascending", "descending"]).default("none"),
		centerMetric: z.enum(["none", "total"]).default("none"),
	})
	.strict();
export type PieConfigV1 = z.infer<typeof pieConfigV1Schema>;

export const radarConfigV1Schema = z
	.object({
		showLegend: z.boolean().default(true),
		showGrid: z.boolean().default(true),
		showAxisLabels: z.boolean().default(true),
		showDots: z.boolean().default(true),
		fillOpacity: z.number().finite().min(0).max(0.8).default(0.2),
		max: z
			.union([z.literal("auto"), z.number().finite().positive()])
			.default("auto"),
		scaleMode: z.enum(["shared", "percent"]).default("shared"),
	})
	.strict();
export type RadarConfigV1 = z.infer<typeof radarConfigV1Schema>;

export const radialBarConfigV1Schema = z
	.object({
		showLegend: z.boolean().default(true),
		showLabels: z.boolean().default(true),
		startAngle: z.number().finite().min(-360).max(360).default(90),
		endAngle: z.number().finite().min(-360).max(360).default(-270),
		innerRadiusPercent: z.number().finite().min(0).max(90).default(20),
		outerRadiusPercent: z.number().finite().min(10).max(100).default(90),
		max: z
			.union([z.literal("auto"), z.number().finite().positive()])
			.default("auto"),
		showTrack: z.boolean().default(true),
	})
	.strict()
	.superRefine((value, context) => {
		if (value.startAngle === value.endAngle)
			context.addIssue({
				code: "custom",
				path: ["endAngle"],
				message: "angles must differ",
			});
		if (value.innerRadiusPercent >= value.outerRadiusPercent)
			context.addIssue({
				code: "custom",
				path: ["innerRadiusPercent"],
				message: "inner radius must be less than outer radius",
			});
	});
export type RadialBarConfigV1 = z.infer<typeof radialBarConfigV1Schema>;

export const funnelConfigV1Schema = z
	.object({
		showLegend: z.boolean().default(true),
		showLabels: z.boolean().default(true),
		labelContent: z
			.enum(["value", "percent-first", "percent-previous", "both"])
			.default("both"),
		enforceMonotonic: z.boolean().default(true),
		lastShape: z.enum(["triangle", "rectangle"]).default("triangle"),
	})
	.strict();
export type FunnelConfigV1 = z.infer<typeof funnelConfigV1Schema>;

function contract<T>(input: {
	type: string;
	displayName: string;
	category: "category" | "hierarchy";
	presets: readonly string[];
	supportedShapes: Array<"category" | "scalar" | "hierarchy">;
	minimumSize: { w: number; h: number };
	recommendedSize: { w: number; h: number };
	configSchema: z.ZodType<T>;
	defaults: Record<string, DashboardJsonObject>;
}): VisualizationDefinition<T> {
	return {
		descriptor: {
			type: input.type,
			displayName: input.displayName,
			description: `${input.displayName} visualization`,
			category: input.category,
			configSchemaVersion: 1,
			presets: presets(input.presets),
			defaultPreset: input.presets[0] as string,
			supportedShapes: input.supportedShapes,
			minimumSize: input.minimumSize,
			recommendedSize: input.recommendedSize,
			capabilities,
		},
		configSchema: input.configSchema,
		defaultOptionsByPreset: input.defaults,
	};
}

const pieDefaults = Object.fromEntries(
	pieIds.map((id) => [
		id,
		{
			showLegend: true,
			showLabels: "auto",
			labelContent: "percent",
			paddingAngle: 1,
			cornerRadius: 0,
			sort: "none",
			centerMetric: id === "donut" || id === "semi-donut" ? "total" : "none",
		},
	]),
) as Record<string, DashboardJsonObject>;
export const corePieVisualizationContract = contract({
	type: "core.pie",
	displayName: "Pie",
	category: "category",
	presets: pieIds,
	supportedShapes: ["category"],
	minimumSize: { w: 4, h: 4 },
	recommendedSize: { w: 6, h: 5 },
	configSchema: pieConfigV1Schema,
	defaults: pieDefaults,
});

const radarDefaults = Object.fromEntries(
	radarIds.map((id) => [
		id,
		{
			showLegend: true,
			showGrid: true,
			showAxisLabels: true,
			showDots: true,
			fillOpacity: id === "line" ? 0 : 0.2,
			max: "auto",
			scaleMode: id === "filled" ? "percent" : "shared",
		},
	]),
) as Record<string, DashboardJsonObject>;
export const coreRadarVisualizationContract = contract({
	type: "core.radar",
	displayName: "Radar",
	category: "category",
	presets: radarIds,
	supportedShapes: ["category"],
	minimumSize: { w: 5, h: 4 },
	recommendedSize: { w: 7, h: 5 },
	configSchema: radarConfigV1Schema,
	defaults: radarDefaults,
});

const radialDefaults = Object.fromEntries(
	radialIds.map((id) => [
		id,
		{
			showLegend: true,
			showLabels: true,
			startAngle: 90,
			endAngle: -270,
			innerRadiusPercent: 20,
			outerRadiusPercent: 90,
			max: id === "progress" ? 100 : "auto",
			showTrack: id === "progress",
		},
	]),
) as Record<string, DashboardJsonObject>;
export const coreRadialBarVisualizationContract = contract({
	type: "core.radial-bar",
	displayName: "Radial bar",
	category: "category",
	presets: radialIds,
	supportedShapes: ["category", "scalar"],
	minimumSize: { w: 4, h: 4 },
	recommendedSize: { w: 6, h: 5 },
	configSchema: radialBarConfigV1Schema,
	defaults: radialDefaults,
});

const funnelDefaults = Object.fromEntries(
	funnelIds.map((id) => [
		id,
		{
			showLegend: true,
			showLabels: true,
			labelContent: "both",
			enforceMonotonic: true,
			lastShape: "triangle",
		},
	]),
) as Record<string, DashboardJsonObject>;
export const coreFunnelVisualizationContract = contract({
	type: "core.funnel",
	displayName: "Funnel",
	category: "category",
	presets: funnelIds,
	supportedShapes: ["category"],
	minimumSize: { w: 4, h: 4 },
	recommendedSize: { w: 6, h: 5 },
	configSchema: funnelConfigV1Schema,
	defaults: funnelDefaults,
});

export type DashboardColorToken = string;
