import { statConfigV2Schema } from "@shared/schemas/dashboard/kpi-visualizations.schema";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { countKpiItems } from "../kpi/model";
export const statConfigSchema = statConfigV2Schema;
export const coreStatDefinition = defineFrontendVisualization({
	descriptor: {
		type: "core.stat",
		displayName: "Stat",
		description: "Single value",
		category: "kpi",
		configSchemaVersion: 2,
		presets: [
			["value", "Value", "Current value"],
			["value-delta", "Value + delta", "Current value and previous difference"],
			["value-sparkline", "Value + sparkline", "Compact time trend"],
			["value-delta-sparkline", "Value + delta + sparkline", "Combined KPI"],
			["value-list", "Value list", "Multiple KPI scorecard"],
		].map(([id, displayName, description]) => ({
			id,
			displayName,
			description,
		})),
		defaultPreset: "value",
		supportedShapes: ["scalar", "timeseries", "category", "table"],
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
	configSchema: statConfigSchema,
	defaultOptionsByPreset: {
		value: {},
		"value-delta": {},
		"value-sparkline": {},
		"value-delta-sparkline": {},
		"value-list": {},
	},
	validateFrames: (frames: DashboardDataFrameV2[], config, preset) => {
		const frame = frames[0];
		if (!frame) return "Stat data frame is missing";
		if (preset.includes("sparkline")) {
			const field = frame.fields.find((item) => item.roles.includes("value"));
			if (field?.type !== "number")
				return "Stat sparkline requires a numeric value field";
			if (field.values.length > config.sparkline.maxPoints)
				return `Stat sparkline supports at most ${config.sparkline.maxPoints} points`;
		}
		if (preset === "value-list") {
			if (countKpiItems(frame) > config.list.maxItems)
				return `Stat list supports at most ${config.list.maxItems} items`;
		}
		return undefined;
	},
	load: () => import("./renderer.lazy"),
	loadPolicy: "immediate",
});
