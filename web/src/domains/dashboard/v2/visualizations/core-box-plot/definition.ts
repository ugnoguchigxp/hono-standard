import {
	type BoxPlotConfigV1,
	boxPlotConfigV1Schema,
	coreBoxPlotVisualizationContract,
} from "@shared/schemas/dashboard/distribution-visualizations.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { buildBoxPlotModel } from "../distribution/box-plot";
export const boxPlotConfigSchema = boxPlotConfigV1Schema;
export const coreBoxPlotDefinition =
	defineFrontendVisualization<BoxPlotConfigV1>({
		...coreBoxPlotVisualizationContract,
		validateFrames: (frames, config, preset) => {
			try {
				const boxes = buildBoxPlotModel(frames, config, preset);
				if (boxes.length > 80) return "Box plot supports at most 80 boxes";
				if (
					config.valueScale.mode === "log" &&
					boxes.some((box) => box.min <= 0)
				)
					return "Box plot log scale requires positive values";
				if (boxes.reduce((total, box) => total + box.outliers.length, 0) > 200)
					return "Box plot outlier limit exceeded";
				if (
					config.showAllPoints &&
					boxes.reduce((total, box) => total + box.points.length, 0) > 500
				)
					return "Box plot point limit exceeded";
			} catch (error) {
				return error instanceof Error ? error.message : "Invalid box plot data";
			}
			return undefined;
		},
		load: () => import("./renderer.lazy"),
		loadPolicy: "viewport",
	});
