/* c8 ignore file */
import type { NodeGraphConfig } from "@shared/schemas/dashboard/specialized-visualizations.schema";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import { buildGraphModel } from "../graph/graph-model";

export { NodeGraphRenderer as Renderer } from "../specialized-renderer";

export function buildAccessibleSummary(
	context: DashboardRendererContext<NodeGraphConfig>,
) {
	try {
		const nodes = context.frames.find(
			(frame) => frame.meta.shapeHint === "graph-nodes",
		);
		const edges = context.frames.find(
			(frame) => frame.meta.shapeHint === "graph-edges",
		);
		if (!nodes || !edges) throw new Error("graph data is unavailable");
		const model = buildGraphModel(nodes, edges, context.preset);
		return `${context.panel.accessibleLabel}: ${model.nodes.length} nodes, ${model.edges.length} edges, ${model.sccs.filter((component) => component.length > 1).length} cycles${model.criticalComponents.length ? `; critical path ${model.criticalComponents.map((component) => `{${component.join(",")}}`).join(" → ")}` : ""}`.slice(
			0,
			1000,
		);
	} catch {
		return `${context.panel.accessibleLabel}: graph data is unavailable`;
	}
}
