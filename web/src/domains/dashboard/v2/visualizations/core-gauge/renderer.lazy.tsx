import type { z } from "zod";
import { GaugeSummary, GaugeView } from "../kpi/family-renderers";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import type { gaugeConfigSchema } from "@shared/schemas/dashboard/kpi-visualizations.schema";
type Config = z.infer<typeof gaugeConfigSchema>;
export function Renderer(context: DashboardRendererContext<Config>) {
	return <GaugeView {...context} config={context.config} />;
}
export function buildAccessibleSummary(
	context: DashboardRendererContext<Config>,
) {
	return GaugeSummary({ ...context, config: context.config });
}
