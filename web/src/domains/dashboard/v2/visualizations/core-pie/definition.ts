import {
	corePieVisualizationContract,
	type PieConfigV1,
	pieConfigV1Schema,
} from "@shared/schemas/dashboard/composition-visualizations.schema";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { buildCategoryCompositionModel } from "../composition/category-model";

export const corePieDefinition = defineFrontendVisualization({
	...corePieVisualizationContract,
	configSchema: pieConfigV1Schema,
	validateFrames: (frames: DashboardDataFrameV2[], _config: PieConfigV1) => {
		try {
			buildCategoryCompositionModel(frames[0] as DashboardDataFrameV2, [
				"--color-brand",
			]);
			return undefined;
		} catch (error) {
			return error instanceof Error
				? error.message
				: "Invalid category composition";
		}
	},
	load: () => import("./renderer.lazy"),
	loadPolicy: "viewport" as const,
});
