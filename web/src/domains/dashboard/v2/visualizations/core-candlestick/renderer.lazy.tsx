/* c8 ignore file */
import type { CandlestickConfig } from "@shared/schemas/dashboard/specialized-visualizations.schema";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import { buildOhlcModel } from "../financial/ohlc-model";

export { CandlestickRenderer as Renderer } from "../specialized-renderer";

export function buildAccessibleSummary(
	context: DashboardRendererContext<CandlestickConfig>,
) {
	try {
		const frame = context.frames[0];
		if (!frame) throw new Error("OHLC data is unavailable");
		const model = buildOhlcModel(frame, context.config, 360, context.preset);
		const first = model.rawRows[0];
		const last = model.rawRows.at(-1);
		return `${context.panel.accessibleLabel}: ${model.rawRows.length} OHLC rows${first && last ? `; first close ${first.close}, last close ${last.close}, change ${last.close - first.close}` : ""}`.slice(
			0,
			1000,
		);
	} catch {
		return `${context.panel.accessibleLabel}: OHLC data is unavailable`;
	}
}
