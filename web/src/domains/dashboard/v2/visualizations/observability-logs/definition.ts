import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { observabilityLogsVisualizationContract } from "@shared/schemas/dashboard/specialized-visualizations.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { buildLogModel } from "../logs/log-model";
export const observabilityLogsDefinition = defineFrontendVisualization({
	...observabilityLogsVisualizationContract,
	descriptor: {
		...observabilityLogsVisualizationContract.descriptor,
		capabilities: {
			...observabilityLogsVisualizationContract.descriptor.capabilities,
			annotations: true,
		},
	},
	validateFrames: (frames: DashboardDataFrameV2[], config, preset) => {
		const frame = frames[0];
		if (!frame || frames.length !== 1) return "Logs requires one log frame";
		try {
			buildLogModel(frame, config, preset);
			return undefined;
		} catch (error) {
			return error instanceof Error ? error.message : "Invalid log data";
		}
	},
	load: () => import("./renderer.lazy"),
	loadPolicy: "viewport" as const,
});
