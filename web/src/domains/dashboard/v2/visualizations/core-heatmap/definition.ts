import {
	coreHeatmapVisualizationContract,
	type HeatmapConfigV1,
	heatmapConfigV1Schema,
} from "@shared/schemas/dashboard/distribution-visualizations.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { buildMatrixModel } from "../distribution/matrix";
export const heatmapConfigSchema = heatmapConfigV1Schema;
export const coreHeatmapDefinition =
	defineFrontendVisualization<HeatmapConfigV1>({
		...coreHeatmapVisualizationContract,
		validateFrames: (frames, config, preset) => {
			const frame = frames[0];
			if (!frame) return "Heatmap data frame is missing";
			try {
				const model = buildMatrixModel(frame, config);
				if (model.x.length > 100 || model.y.length > 100)
					return "Heatmap supports at most 100 x and y categories";
				if (model.cells.length > (preset === "annotated" ? 400 : 2_000))
					return "Heatmap cell limit exceeded";
				if (preset === "diverging" && config.colorScale.mode !== "diverging")
					return "Diverging heatmap requires a diverging color scale";
			} catch (error) {
				return error instanceof Error ? error.message : "Invalid heatmap data";
			}
			return undefined;
		},
		load: () => import("./renderer.lazy"),
		loadPolicy: "viewport",
	});
