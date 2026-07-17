import { trafficLightConfigSchema } from "@shared/schemas/dashboard/kpi-visualizations.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { countKpiItems } from "../kpi/model";
export const coreTrafficLightDefinition = defineFrontendVisualization({
	descriptor: {
		type: "core.traffic-light",
		displayName: "Traffic Light",
		description: "Semantic status signal",
		category: "status",
		configSchemaVersion: 1,
		presets: [
			{ id: "single", displayName: "Single", description: "One signal" },
			{ id: "list", displayName: "List", description: "Status list" },
			{ id: "matrix", displayName: "Matrix", description: "Status matrix" },
		],
		defaultPreset: "single",
		supportedShapes: ["scalar", "category", "table", "matrix"],
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
	configSchema: trafficLightConfigSchema,
	defaultOptionsByPreset: { single: {}, list: {}, matrix: {} },
	validateFrames: (frames, _config, preset) => {
		const fields = frames[0]?.fields ?? [];
		if (
			preset === "single" &&
			fields.length > 1 &&
			!fields.some(
				(field) =>
					field.roles.includes("state") || field.roles.includes("value"),
			)
		)
			return "Traffic Light state is missing";
		if (preset === "list" && countKpiItems(frames[0]) > 30)
			return "Traffic Light supports at most 30 items";
		if (
			preset === "matrix" &&
			countKpiItems(frames[0]) *
				Math.max(1, fields.filter((field) => field.type === "number").length) >
				160
		)
			return "Traffic Light matrix supports at most 160 cells";
		return undefined;
	},
	load: () => import("./renderer.lazy"),
	loadPolicy: "viewport",
});
