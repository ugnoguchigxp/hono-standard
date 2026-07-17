import { z } from "zod";
import type { DashboardJsonObject } from "./json-value.schema";
import type { VisualizationDefinition } from "./visualization.schema";

export const treemapConfigV1Schema = z
	.object({
		showLabels: z.enum(["auto", "always", "never"]).default("auto"),
		labelContent: z.enum(["category", "value", "both"]).default("both"),
		padding: z.number().finite().min(0).max(12).default(4),
		colorBy: z.enum(["item", "top-level", "depth"]).default("top-level"),
		maxLabelDepth: z.number().int().min(1).max(6).default(3),
	})
	.strict();
export type TreemapConfigV1 = z.infer<typeof treemapConfigV1Schema>;
export const sunburstConfigV1Schema = z
	.object({
		showLabels: z.enum(["auto", "always", "never"]).default("auto"),
		innerRadius: z.number().finite().min(0).max(120).default(24),
		ringPadding: z.number().finite().min(0).max(12).default(4),
		sectorPadding: z.number().finite().min(0).max(8).default(1),
		colorBy: z.enum(["top-level", "depth"]).default("top-level"),
		maxLabelDepth: z.number().int().min(1).max(6).default(3),
	})
	.strict();
export type SunburstConfigV1 = z.infer<typeof sunburstConfigV1Schema>;
export const sankeyConfigV1Schema = z
	.object({
		nodeWidth: z.number().int().min(4).max(40).default(12),
		nodePadding: z.number().int().min(0).max(48).default(16),
		iterations: z.number().int().min(1).max(64).default(32),
		align: z.enum(["left", "justify"]).default("justify"),
		verticalAlign: z.enum(["top", "justify"]).default("justify"),
		linkOpacity: z.number().finite().min(0.05).max(0.8).default(0.28),
		showNodeLabels: z.boolean().default(true),
	})
	.strict();
export type SankeyConfigV1 = z.infer<typeof sankeyConfigV1Schema>;

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
const make = <T>(
	type: string,
	displayName: string,
	presetIds: readonly string[],
	shapes: Array<"category" | "hierarchy" | "graph-nodes" | "graph-edges">,
	schema: z.ZodType<T>,
	defaults: Record<string, DashboardJsonObject>,
): VisualizationDefinition<T> => ({
	descriptor: {
		type,
		displayName,
		description: `${displayName} visualization`,
		category: type === "core.sankey" ? "flow" : "hierarchy",
		configSchemaVersion: 1,
		presets: presets(presetIds),
		defaultPreset: presetIds[0] as string,
		supportedShapes: shapes,
		minimumSize: type === "core.sankey" ? { w: 7, h: 5 } : { w: 5, h: 4 },
		recommendedSize: type === "core.sankey" ? { w: 12, h: 6 } : { w: 8, h: 6 },
		capabilities,
	},
	configSchema: schema,
	defaultOptionsByPreset: defaults,
});

export const coreTreemapVisualizationContract = make(
	"core.treemap",
	"Treemap",
	["flat", "nested"],
	["category", "hierarchy"],
	treemapConfigV1Schema,
	{
		flat: {
			showLabels: "auto",
			labelContent: "both",
			padding: 4,
			colorBy: "item",
			maxLabelDepth: 3,
		},
		nested: {
			showLabels: "auto",
			labelContent: "both",
			padding: 4,
			colorBy: "top-level",
			maxLabelDepth: 3,
		},
	},
);
export const coreSunburstVisualizationContract = make(
	"core.sunburst",
	"Sunburst",
	["sunburst"],
	["hierarchy"],
	sunburstConfigV1Schema,
	{
		sunburst: {
			showLabels: "auto",
			innerRadius: 24,
			ringPadding: 4,
			sectorPadding: 1,
			colorBy: "top-level",
			maxLabelDepth: 3,
		},
	},
);
export const coreSankeyVisualizationContract = make(
	"core.sankey",
	"Sankey",
	["sankey"],
	["graph-nodes", "graph-edges"],
	sankeyConfigV1Schema,
	{
		sankey: {
			nodeWidth: 12,
			nodePadding: 16,
			iterations: 32,
			align: "justify",
			verticalAlign: "justify",
			linkOpacity: 0.28,
			showNodeLabels: true,
		},
	},
);
