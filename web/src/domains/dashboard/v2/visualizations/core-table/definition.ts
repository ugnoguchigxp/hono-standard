import { z } from "zod";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
export const tableConfigSchema = z
	.object({
		showLegend: z.boolean().optional(),
		fill: z.string().optional(),
		connectNulls: z.boolean().optional(),
		yAxisScale: z.string().optional(),
		yAxisMin: z.union([z.literal("auto"), z.number()]).optional(),
		yAxisMax: z.union([z.literal("auto"), z.number()]).optional(),
		referenceLines: z.array(z.unknown()).optional(),
	})
	.strict();
export const coreTableDefinition = defineFrontendVisualization({
	descriptor: {
		type: "core.table",
		displayName: "Table",
		description: "Data table",
		category: "data",
		configSchemaVersion: 1,
		presets: [{ id: "table", displayName: "Table", description: "Table" }],
		defaultPreset: "table",
		supportedShapes: ["table", "timeseries", "category", "scalar"],
		minimumSize: { w: 3, h: 3 },
		recommendedSize: { w: 6, h: 5 },
		capabilities: {
			legend: false,
			tooltip: false,
			sharedCrosshair: false,
			zoom: false,
			rangeSelection: false,
			annotations: false,
			fieldOverrides: true,
			tableFallback: true,
			exportImage: false,
			exportData: true,
			mobileSummary: true,
		},
	},
	configSchema: tableConfigSchema,
	defaultOptionsByPreset: { table: {} },
	load: () => import("./renderer.lazy"),
	loadPolicy: "immediate",
});
