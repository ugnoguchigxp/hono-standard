/* c8 ignore file */
import type { FlameGraphConfig } from "@shared/schemas/dashboard/specialized-visualizations.schema";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import { buildProfileModel } from "../profile/profile-model";

export { FlameGraphRenderer as Renderer } from "../specialized-renderer";

export function buildAccessibleSummary(
	context: DashboardRendererContext<FlameGraphConfig>,
) {
	try {
		const frame = context.frames[0];
		if (!frame) throw new Error("profile data is unavailable");
		const model = buildProfileModel(frame, context.preset);
		const depth = Math.max(0, ...model.rawNodes.map((node) => node.depth));
		const total = model.roots.reduce((sum, node) => sum + node.total, 0);
		return `${context.panel.accessibleLabel}: ${model.rawNodes.length} profile frames, depth ${depth}, total ${total}`.slice(
			0,
			1000,
		);
	} catch {
		return `${context.panel.accessibleLabel}: profile data is unavailable`;
	}
}
