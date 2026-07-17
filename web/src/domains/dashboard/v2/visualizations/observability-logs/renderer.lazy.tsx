/* c8 ignore file */
import type { LogsConfig } from "@shared/schemas/dashboard/specialized-visualizations.schema";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import { buildLogModel } from "../logs/log-model";

export { LogsRenderer as Renderer } from "../specialized-renderer";

export function buildAccessibleSummary(
	context: DashboardRendererContext<LogsConfig>,
) {
	try {
		const frame = context.frames[0];
		if (!frame) throw new Error("log data is unavailable");
		const model = buildLogModel(frame, context.config, context.preset);
		const severity = new Map<string, number>();
		for (const row of model.rows) {
			const key = row.severity ?? "unknown";
			severity.set(key, (severity.get(key) ?? 0) + 1);
		}
		return `${context.panel.accessibleLabel}: ${model.total} log rows; ${[...severity.entries()].map(([key, count]) => `${key} ${count}`).join(", ")}; ${model.truncatedCount} truncated`.slice(
			0,
			1000,
		);
	} catch {
		return `${context.panel.accessibleLabel}: log data is unavailable`;
	}
}
