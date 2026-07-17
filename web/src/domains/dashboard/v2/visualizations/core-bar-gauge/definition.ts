import { barGaugeConfigSchema } from "@shared/schemas/dashboard/kpi-visualizations.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { countKpiItems } from "../kpi/model";
export const coreBarGaugeDefinition = defineFrontendVisualization({
	descriptor: {
		type: "core.bar-gauge",
		displayName: "Bar Gauge",
		description: "Native range bars",
		category: "kpi",
		configSchemaVersion: 1,
		presets: [
			{
				id: "horizontal",
				displayName: "Horizontal",
				description: "Horizontal bars",
			},
			{ id: "vertical", displayName: "Vertical", description: "Vertical bars" },
			{
				id: "segmented",
				displayName: "Segmented",
				description: "Segmented bars",
			},
			{
				id: "retro-lcd",
				displayName: "Retro LCD",
				description: "Compact segmented bars",
			},
		],
		defaultPreset: "horizontal",
		supportedShapes: ["scalar", "category", "table"],
		minimumSize: { w: 2, h: 2 },
		recommendedSize: { w: 6, h: 4 },
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
	configSchema: barGaugeConfigSchema,
	defaultOptionsByPreset: {
		horizontal: {},
		vertical: {},
		segmented: {},
		"retro-lcd": {},
	},
	validateFrames: (frames, config) =>
		countKpiItems(frames[0]) > 20
			? "Bar Gauge supports at most 20 items"
			: config.segmentCount * Math.max(1, countKpiItems(frames[0])) > 400
				? "Bar Gauge segment limit exceeded"
				: undefined,
	load: () => import("./renderer.lazy"),
	loadPolicy: "viewport",
});
