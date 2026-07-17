/* c8 ignore file */
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import type { GeomapConfig } from "@shared/schemas/dashboard/specialized-visualizations.schema";
import worldAsset from "../geo/assets/world-110m.paths.json";
import { buildGeoModel } from "../geo/geo-model";
import { GeoMapRenderer } from "../specialized-renderer";

export function Renderer(context: DashboardRendererContext<GeomapConfig>) {
	return <GeoMapRenderer {...context} worldAsset={worldAsset} />;
}

export function buildAccessibleSummary(
	context: DashboardRendererContext<GeomapConfig>,
) {
	try {
		const frame = context.frames[0];
		if (!frame) throw new Error("geo data is unavailable");
		const model = buildGeoModel(
			frame,
			context.preset,
			1_000,
			500,
			context.config.clusterCellPx,
		);
		return `${context.panel.accessibleLabel}: ${model.points.length} points, ${model.routes.length} routes, ${model.regions.length} regions, ${model.clusters.length} clusters`.slice(
			0,
			1000,
		);
	} catch {
		return `${context.panel.accessibleLabel}: geo data is unavailable`;
	}
}
