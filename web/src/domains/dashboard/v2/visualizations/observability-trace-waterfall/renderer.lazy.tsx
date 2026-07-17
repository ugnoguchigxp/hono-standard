/* c8 ignore file */
import type { TraceConfig } from "@shared/schemas/dashboard/specialized-visualizations.schema";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import { buildTraceModel } from "../trace/trace-model";
import { resolveTraceDurationMultiplier } from "../specialized/units";

export { TraceRenderer as Renderer } from "../specialized-renderer";

export function buildAccessibleSummary(
	context: DashboardRendererContext<TraceConfig>,
) {
	try {
		const frame = context.frames[0];
		if (!frame) throw new Error("trace data is unavailable");
		const duration = resolveTraceDurationMultiplier(
			frame,
			context.panel.visualization,
		);
		if ("error" in duration) throw new Error(duration.error);
		const model = buildTraceModel(
			frame,
			context.config,
			context.preset,
			duration.multiplier,
		);
		return `${context.panel.accessibleLabel}: ${model.allSpans.length} spans, ${model.envelope.to - model.envelope.from} ms envelope; estimated critical chain ${model.criticalPathSpanIds.join(" → ") || "none"}`.slice(
			0,
			1000,
		);
	} catch {
		return `${context.panel.accessibleLabel}: trace data is unavailable`;
	}
}
