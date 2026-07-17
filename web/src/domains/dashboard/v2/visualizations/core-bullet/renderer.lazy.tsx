import type { z } from "zod";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import type { bulletConfigSchema } from "@shared/schemas/dashboard/kpi-visualizations.schema";
import { BulletSummary, BulletView } from "../kpi/family-renderers";
type Config = z.infer<typeof bulletConfigSchema>;
export function Renderer(context: DashboardRendererContext<Config>) {
	return <BulletView {...context} config={context.config} />;
}
export function buildAccessibleSummary(
	context: DashboardRendererContext<Config>,
) {
	return BulletSummary({ ...context, config: context.config });
}
