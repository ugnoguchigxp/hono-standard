import {
	coreTreemapVisualizationContract,
	treemapConfigV1Schema,
} from "@shared/schemas/dashboard/hierarchy-flow-visualizations.schema";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { buildCategoryCompositionModel } from "../composition/category-model";
import { buildHierarchyModel } from "../hierarchy/hierarchy-model";

export const coreTreemapDefinition = defineFrontendVisualization({
	...coreTreemapVisualizationContract,
	configSchema: treemapConfigV1Schema,
	validateFrames: (frames: DashboardDataFrameV2[], _config, preset) => {
		const frame = frames[0];
		if (!frame) return "Treemap frame is missing";
		try {
			if (preset === "flat")
				buildCategoryCompositionModel(frame, ["--color-brand"]);
			else buildHierarchyModel(frame, ["--color-brand"]);
			return undefined;
		} catch (error) {
			return error instanceof Error ? error.message : "Invalid treemap data";
		}
	},
	load: () => import("./renderer.lazy"),
	loadPolicy: "viewport" as const,
});
