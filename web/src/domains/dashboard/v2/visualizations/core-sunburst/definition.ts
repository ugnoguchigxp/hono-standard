import {
	coreSunburstVisualizationContract,
	sunburstConfigV1Schema,
} from "@shared/schemas/dashboard/hierarchy-flow-visualizations.schema";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { buildHierarchyModel } from "../hierarchy/hierarchy-model";

export const coreSunburstDefinition = defineFrontendVisualization({
	...coreSunburstVisualizationContract,
	configSchema: sunburstConfigV1Schema,
	validateFrames: (frames: DashboardDataFrameV2[]) => {
		try {
			buildHierarchyModel(frames[0] as DashboardDataFrameV2, ["--color-brand"]);
			return undefined;
		} catch (error) {
			return error instanceof Error ? error.message : "Invalid sunburst data";
		}
	},
	load: () => import("./renderer.lazy"),
	loadPolicy: "viewport" as const,
});
