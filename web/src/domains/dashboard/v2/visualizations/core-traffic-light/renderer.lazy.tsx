import type { z } from "zod";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import type { trafficLightConfigSchema } from "@shared/schemas/dashboard/kpi-visualizations.schema";
import { TrafficSummary, TrafficView } from "../kpi/family-renderers";
type Config = z.infer<typeof trafficLightConfigSchema>;
export function Renderer(context: DashboardRendererContext<Config>) {
	return <TrafficView {...context} config={context.config} />;
}
export function buildAccessibleSummary(
	context: DashboardRendererContext<Config>,
) {
	return TrafficSummary({ ...context, config: context.config });
}
