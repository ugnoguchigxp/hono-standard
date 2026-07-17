import type { z } from "zod";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import type { progressConfigSchema } from "@shared/schemas/dashboard/kpi-visualizations.schema";
import { ProgressSummary, ProgressView } from "../kpi/family-renderers";
type Config = z.infer<typeof progressConfigSchema>;
export function Renderer(context: DashboardRendererContext<Config>) {
	return <ProgressView {...context} config={context.config} />;
}
export function buildAccessibleSummary(
	context: DashboardRendererContext<Config>,
) {
	return ProgressSummary({ ...context, config: context.config });
}
