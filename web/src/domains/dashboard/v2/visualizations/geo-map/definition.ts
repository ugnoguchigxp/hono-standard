import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { geoMapVisualizationContract } from "@shared/schemas/dashboard/specialized-visualizations.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { buildGeoModel } from "../geo/geo-model";
export const geoMapDefinition = defineFrontendVisualization({
	...geoMapVisualizationContract,
	validateFrames: (frames: DashboardDataFrameV2[], config, preset) => {
		const frame = frames[0];
		if (!frame || frames.length !== 1) return "Geomap requires one geo frame";
		if (
			preset === "regions" &&
			(!frame.fields.some((field) => field.roles.includes("region-id")) ||
				!frame.fields.some((field) => field.roles.includes("value")))
		)
			return "Regions preset requires region-id and value";
		try {
			buildGeoModel(frame, preset, 720, 360, config.clusterCellPx);
			return undefined;
		} catch (error) {
			return error instanceof Error ? error.message : "Invalid geo data";
		}
	},
	load: () => import("./renderer.lazy"),
	loadPolicy: "viewport" as const,
});
