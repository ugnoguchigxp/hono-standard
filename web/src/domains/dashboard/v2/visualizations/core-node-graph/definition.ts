import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { coreNodeGraphVisualizationContract } from "@shared/schemas/dashboard/specialized-visualizations.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { buildGraphModel } from "../graph/graph-model";
export const coreNodeGraphDefinition = defineFrontendVisualization({
	...coreNodeGraphVisualizationContract,
	validateFrames: (frames: DashboardDataFrameV2[], _config, preset) => {
		if (frames.length !== 2)
			return "Node Graph requires nodes and edges frames";
		const nodes = frames.find(
			(frame) => frame.meta.shapeHint === "graph-nodes",
		);
		const edges = frames.find(
			(frame) => frame.meta.shapeHint === "graph-edges",
		);
		if (!nodes || !edges)
			return "Node Graph requires graph-nodes and graph-edges frames";
		if (
			preset === "grouped" &&
			!nodes.fields.some((field) => field.roles.includes("category"))
		)
			return "Grouped preset requires category";
		if (
			preset === "critical-path" &&
			![...nodes.fields, ...edges.fields].some(
				(field) =>
					field.roles.includes("value") &&
					field.values.some(
						(value) => typeof value === "number" && Number.isFinite(value),
					),
			)
		)
			return "Critical path requires a numeric value";
		try {
			buildGraphModel(nodes, edges, preset);
			return undefined;
		} catch (error) {
			return error instanceof Error ? error.message : "Invalid graph data";
		}
	},
	load: () => import("./renderer.lazy"),
	loadPolicy: "viewport" as const,
});
