import { progressConfigSchema } from "@shared/schemas/dashboard/kpi-visualizations.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { countKpiItems } from "../kpi/model";
import { buildProgressSteps } from "../kpi/progress-steps";
export const coreProgressDefinition = defineFrontendVisualization({
	descriptor: {
		type: "core.progress",
		displayName: "Progress",
		description: "Completion and workflow progress",
		category: "kpi",
		configSchemaVersion: 1,
		presets: [
			{ id: "linear", displayName: "Linear", description: "Linear progress" },
			{
				id: "segmented",
				displayName: "Segmented",
				description: "Segmented progress",
			},
			{ id: "steps", displayName: "Steps", description: "Workflow steps" },
		],
		defaultPreset: "linear",
		supportedShapes: ["scalar", "category", "table"],
		minimumSize: { w: 2, h: 2 },
		recommendedSize: { w: 6, h: 3 },
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
	configSchema: progressConfigSchema,
	defaultOptionsByPreset: { linear: {}, segmented: {}, steps: {} },
	validateFrames: (frames, config, preset) => {
		const itemCount = countKpiItems(frames[0]);
		if (
			preset === "segmented" &&
			(config.segmentCount < 3 || config.segmentCount > 40)
		)
			return "Progress segment count must be between 3 and 40";
		if (preset === "steps" && (itemCount < 2 || itemCount > 20))
			return "Progress steps must contain 2 to 20 steps";
		if (preset === "steps")
			return buildProgressSteps(frames[0], {
				currentStepFieldKey: config.currentStepFieldKey,
				completedStateValues: config.completedStateValues,
			}).error;
		return undefined;
	},
	load: () => import("./renderer.lazy"),
	loadPolicy: "viewport",
});
