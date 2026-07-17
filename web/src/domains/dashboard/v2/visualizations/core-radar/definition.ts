import {
	coreRadarVisualizationContract,
	radarConfigV1Schema,
	type RadarConfigV1,
} from "@shared/schemas/dashboard/composition-visualizations.schema";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";

export const coreRadarDefinition = defineFrontendVisualization({
	...coreRadarVisualizationContract,
	configSchema: radarConfigV1Schema,
	validateFrames: (
		frames: DashboardDataFrameV2[],
		config: RadarConfigV1,
		preset,
	) => {
		const frame = frames[0];
		if (!frame) return "Radar frame is missing";
		const categories = frame.fields.filter((field) =>
			field.roles.includes("category"),
		);
		const values = frame.fields.filter(
			(field) => field.type === "number" && field.roles.includes("value"),
		);
		if (categories.length !== 1)
			return "Radar requires exactly one category field";
		if (
			categories[0]?.values.length !== undefined &&
			(categories[0].values.length < 3 || categories[0].values.length > 12)
		)
			return "Radar requires 3 to 12 axes";
		if (values.length < 1 || values.length > 8)
			return "Radar requires 1 to 8 value series";
		if (preset === "filled" && values.length !== 1)
			return "Filled radar requires exactly one series";
		if (preset === "multi" && values.length < 2)
			return "Multi radar requires at least two series";
		if (
			values.some((field) =>
				field.values.some(
					(value) =>
						value === null ||
						typeof value !== "number" ||
						!Number.isFinite(value) ||
						value < 0,
				),
			)
		)
			return "Radar values must be finite and non-negative";
		if (
			config.scaleMode === "percent" &&
			values.some((field) =>
				field.values.some((value) => typeof value === "number" && value > 100),
			)
		)
			return "Radar percent values must be between 0 and 100";
		return undefined;
	},
	load: () => import("./renderer.lazy"),
	loadPolicy: "viewport" as const,
});
