import { gaugeConfigSchema } from "@shared/schemas/dashboard/kpi-visualizations.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { countKpiItems } from "../kpi/model";
export const coreGaugeDefinition = defineFrontendVisualization({
	descriptor: {
		type: "core.gauge",
		displayName: "Gauge",
		description: "Native KPI gauge",
		category: "kpi",
		configSchemaVersion: 1,
		presets: [
			{
				id: "semi-circle",
				displayName: "Semi-circle",
				description: "180 degree gauge",
			},
			{
				id: "full-circle",
				displayName: "Full-circle",
				description: "270 degree gauge",
			},
			{
				id: "needle",
				displayName: "Needle",
				description: "Gauge with needle semantics",
			},
		],
		defaultPreset: "semi-circle",
		supportedShapes: ["scalar", "category", "table"],
		minimumSize: { w: 2, h: 2 },
		recommendedSize: { w: 4, h: 3 },
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
	configSchema: gaugeConfigSchema,
	defaultOptionsByPreset: {
		"semi-circle": { startAngle: -180, endAngle: 0 },
		"full-circle": { startAngle: -225, endAngle: 45 },
		needle: { startAngle: -225, endAngle: 45 },
	},
	validateFrames: (frames, _config, _preset) =>
		frames.length > 1
			? "Gauge supports one frame"
			: countKpiItems(frames[0]) > 6
				? "Gauge supports at most 6 items"
				: undefined,
	load: () => import("./renderer.lazy"),
	loadPolicy: "viewport",
});
