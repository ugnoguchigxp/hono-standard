import {
	coreStatusHistoryVisualizationContract,
	statusHistoryConfigV1Schema,
	type StatusHistoryConfigV1,
} from "@shared/schemas/dashboard/state-visualizations.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { buildStateSamples } from "../state/sample-model";
export const coreStatusHistoryDefinition =
	defineFrontendVisualization<StatusHistoryConfigV1>({
		...coreStatusHistoryVisualizationContract,
		validateFrames: (frames, config) => {
			try {
				const frame = frames[0];
				if (!frame) return "Status sample frame is missing";
				const model = buildStateSamples(frame, config);
				if (
					model.samples.length > 5_000 ||
					model.columns.length > 500 ||
					new Set(model.samples.map((item) => item.laneId)).size > 50
				)
					return "Status history limit exceeded";
			} catch (error) {
				return error instanceof Error
					? error.message
					: "Invalid status samples";
			}
			return undefined;
		},
		configSchema: statusHistoryConfigV1Schema,
		load: () => import("./renderer.lazy"),
		loadPolicy: "viewport",
	});
