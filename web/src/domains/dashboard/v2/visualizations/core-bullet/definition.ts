import { bulletConfigSchema } from "@shared/schemas/dashboard/kpi-visualizations.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { countKpiItems } from "../kpi/model";
export const coreBulletDefinition = defineFrontendVisualization({
	descriptor: {
		type: "core.bullet",
		displayName: "Bullet",
		description: "Goal and qualitative bands",
		category: "kpi",
		configSchemaVersion: 1,
		presets: [
			{
				id: "horizontal",
				displayName: "Horizontal",
				description: "Horizontal bullet",
			},
			{
				id: "vertical",
				displayName: "Vertical",
				description: "Vertical bullet",
			},
			{
				id: "comparative",
				displayName: "Comparative",
				description: "Comparative bullets",
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
	configSchema: bulletConfigSchema,
	defaultOptionsByPreset: { horizontal: {}, vertical: {}, comparative: {} },
	validateFrames: (frames, config) => {
		const fields = frames[0]?.fields ?? [];
		if (
			!fields.some((field) => field.roles.includes("goal")) &&
			!config.goalFieldKey
		)
			return "Bullet requires a goal field";
		if (countKpiItems(frames[0]) > 20)
			return "Bullet supports at most 20 items";
		return undefined;
	},
	load: () => import("./renderer.lazy"),
	loadPolicy: "viewport",
});
