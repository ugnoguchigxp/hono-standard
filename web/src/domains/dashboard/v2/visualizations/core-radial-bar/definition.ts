import {
	coreRadialBarVisualizationContract,
	radialBarConfigV1Schema,
	type RadialBarConfigV1,
} from "@shared/schemas/dashboard/composition-visualizations.schema";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { buildRadialBarModel, resolveRadialBarMax } from "./model";

export const coreRadialBarDefinition = defineFrontendVisualization({
	...coreRadialBarVisualizationContract,
	configSchema: radialBarConfigV1Schema,
	validateFrames: (
		frames: DashboardDataFrameV2[],
		config: RadialBarConfigV1,
		preset,
	) => {
		const frame = frames[0];
		if (!frame) return "Radial bar frame is missing";
		try {
			const model = buildRadialBarModel(frame, ["--color-brand"], {
				allowAllZero: preset === "progress",
			});
			if (model.slices.length > (preset === "ranking" ? 20 : 12))
				return "Radial bar category limit exceeded";
			const max = resolveRadialBarMax(model, config.max, preset);
			if (
				preset === "progress" &&
				model.slices.some((slice) => slice.value > max)
			)
				return "Progress value exceeds max";
			return undefined;
		} catch (error) {
			return error instanceof Error ? error.message : "Invalid radial bar data";
		}
	},
	load: () => import("./renderer.lazy"),
	loadPolicy: "viewport" as const,
});
