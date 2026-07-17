import type { DashboardRendererContext } from "../../runtime/visualization-types";
import type { z } from "zod";
import type { tableConfigSchema } from "./definition";
import { PanelTable } from "../../panel/panel-table";
export function Renderer(
	context: DashboardRendererContext<z.infer<typeof tableConfigSchema>>,
) {
	return (
		<PanelTable
			frames={context.frames}
			panel={context.panel}
			timezone={context.timezone}
			locale={context.locale}
		/>
	);
}
export function buildAccessibleSummary({
	panel,
	frames,
}: DashboardRendererContext<z.infer<typeof tableConfigSchema>>) {
	return `${panel.accessibleLabel}: ${frames.reduce((count, frame) => count + (frame.fields[0]?.values.length ?? 0), 0)} rows`;
}
