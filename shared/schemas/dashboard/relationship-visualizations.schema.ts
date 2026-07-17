import { z } from "zod";
import type { DashboardJsonObject } from "./json-value.schema";
import type { VisualizationDefinition } from "./visualization.schema";

export const scatterConfigV1Schema = z
	.object({
		showLegend: z.boolean().default(true),
		showGrid: z.boolean().default(true),
		xFieldKey: z.string().min(1).max(80).optional(),
		yFieldKey: z.string().min(1).max(80).optional(),
		sizeFieldKey: z.string().min(1).max(80).optional(),
		seriesFieldKey: z.string().min(1).max(80).optional(),
		pointSize: z.number().finite().min(10).max(400).default(80),
		bubbleRadius: z
			.object({
				min: z.number().finite().min(2).max(40).default(4),
				max: z.number().finite().min(4).max(80).default(18),
			})
			.strict()
			.default({ min: 4, max: 18 }),
		xAxis: z
			.object({
				min: z.union([z.literal("auto"), z.number().finite()]).default("auto"),
				max: z.union([z.literal("auto"), z.number().finite()]).default("auto"),
			})
			.strict()
			.default({ min: "auto", max: "auto" }),
		yAxis: z
			.object({
				min: z.union([z.literal("auto"), z.number().finite()]).default("auto"),
				max: z.union([z.literal("auto"), z.number().finite()]).default("auto"),
			})
			.strict()
			.default({ min: "auto", max: "auto" }),
		quadrant: z
			.object({
				x: z.number().finite(),
				y: z.number().finite(),
				labels: z.tuple([
					z.string().max(40),
					z.string().max(40),
					z.string().max(40),
					z.string().max(40),
				]),
			})
			.strict()
			.optional(),
	})
	.strict()
	.superRefine((value, context) => {
		if (
			typeof value.bubbleRadius.min === "number" &&
			typeof value.bubbleRadius.max === "number" &&
			value.bubbleRadius.min >= value.bubbleRadius.max
		)
			context.addIssue({
				code: "custom",
				path: ["bubbleRadius", "min"],
				message: "bubble min must be less than max",
			});
		for (const axis of ["xAxis", "yAxis"] as const) {
			const item = value[axis];
			if (
				typeof item.min === "number" &&
				typeof item.max === "number" &&
				item.min >= item.max
			)
				context.addIssue({
					code: "custom",
					path: [axis, "min"],
					message: `${axis} min must be less than max`,
				});
		}
	});
export type ScatterConfigV1 = z.infer<typeof scatterConfigV1Schema>;

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
const ids = ["scatter", "bubble", "quadrant"] as const;
export const coreScatterVisualizationContract: VisualizationDefinition<ScatterConfigV1> =
	{
		descriptor: {
			type: "core.scatter",
			displayName: "Scatter",
			description: "Relationship scatter visualization",
			category: "relationship",
			configSchemaVersion: 1,
			presets: ids.map((id) => ({ id, displayName: id, description: id })),
			defaultPreset: "scatter",
			supportedShapes: ["distribution"],
			minimumSize: { w: 5, h: 4 },
			recommendedSize: { w: 8, h: 5 },
			capabilities,
		},
		configSchema: scatterConfigV1Schema,
		defaultOptionsByPreset: Object.fromEntries(
			ids.map((id) => [
				id,
				{
					showLegend: true,
					showGrid: true,
					pointSize: 80,
					bubbleRadius: { min: 4, max: 18 },
					xAxis: { min: "auto", max: "auto" },
					yAxis: { min: "auto", max: "auto" },
					...(id === "quadrant"
						? { quadrant: { x: 0, y: 0, labels: ["Q1", "Q2", "Q3", "Q4"] } }
						: {}),
				},
			]),
		) as Record<string, DashboardJsonObject>,
	};
