import {
	coreSankeyVisualizationContract,
	sankeyConfigV1Schema,
} from "@shared/schemas/dashboard/hierarchy-flow-visualizations.schema";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { buildSankeyModel } from "../flow/sankey-model";

export const coreSankeyDefinition = defineFrontendVisualization({
	...coreSankeyVisualizationContract,
	configSchema: sankeyConfigV1Schema,
	validateFrames: (frames: DashboardDataFrameV2[]) => {
		if (frames.length !== 2) return "Sankey requires nodes and edges frames";
		const nodes = frames.find(
			(frame) => frame.meta.shapeHint === "graph-nodes",
		);
		const edges = frames.find(
			(frame) => frame.meta.shapeHint === "graph-edges",
		);
		if (!nodes || !edges)
			return "Sankey requires graph-nodes and graph-edges frames";
		try {
			buildSankeyModel(nodes, edges, ["--color-brand"]);
			return undefined;
		} catch (error) {
			return error instanceof Error ? error.message : "Invalid Sankey data";
		}
	},
	load: () => import("./renderer.lazy"),
	loadPolicy: "viewport" as const,
});
