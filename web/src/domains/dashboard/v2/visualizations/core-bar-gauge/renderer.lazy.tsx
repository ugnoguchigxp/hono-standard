import type { z } from "zod";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import type { barGaugeConfigSchema } from "@shared/schemas/dashboard/kpi-visualizations.schema";
import { BarGaugeSummary, BarGaugeView } from "../kpi/family-renderers";
type Config = z.infer<typeof barGaugeConfigSchema>;
export function Renderer(context: DashboardRendererContext<Config>) {
	return <BarGaugeView {...context} config={context.config} />;
}
export function buildAccessibleSummary(
	context: DashboardRendererContext<Config>,
) {
	return BarGaugeSummary({ ...context, config: context.config });
}
