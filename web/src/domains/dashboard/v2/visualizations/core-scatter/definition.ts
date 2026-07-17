import {
	coreScatterVisualizationContract,
	scatterConfigV1Schema,
	type ScatterConfigV1,
} from "@shared/schemas/dashboard/relationship-visualizations.schema";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { buildScatterModel } from "../relationship/scatter-model";

export const coreScatterDefinition = defineFrontendVisualization({
	...coreScatterVisualizationContract,
	configSchema: scatterConfigV1Schema,
	validateFrames: (
		frames: DashboardDataFrameV2[],
		config: ScatterConfigV1,
		preset,
	) => {
		try {
			const models = frames.map((frame) =>
				buildScatterModel(frame, {
					...config,
					palette: ["--color-brand"],
				}),
			);
			if (preset === "bubble" && models.some((model) => !model.hasSize))
				return "Bubble preset requires exactly one numeric size field";
			if (preset === "quadrant" && !config.quadrant)
				return "Quadrant preset requires quadrant thresholds";
			return undefined;
		} catch (error) {
			return error instanceof Error ? error.message : "Invalid scatter data";
		}
	},
	load: () => import("./renderer.lazy"),
	loadPolicy: "viewport" as const,
});
