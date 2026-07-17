import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { observabilityTraceVisualizationContract } from "@shared/schemas/dashboard/specialized-visualizations.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { buildTraceModel } from "../trace/trace-model";
import { resolveTraceDurationMultiplier } from "../specialized/units";
export const observabilityTraceWaterfallDefinition =
	defineFrontendVisualization({
		...observabilityTraceVisualizationContract,
		descriptor: {
			...observabilityTraceVisualizationContract.descriptor,
			capabilities: {
				...observabilityTraceVisualizationContract.descriptor.capabilities,
				annotations: true,
			},
		},
		validateFrames: (frames: DashboardDataFrameV2[]) => {
			const frame = frames[0];
			if (!frame || frames.length !== 1)
				return "Trace waterfall requires one trace frame";
			return undefined;
		},
		validateResolvedFrames: (frames, config, preset, spec) => {
			const frame = frames[0];
			if (!frame) return "Trace waterfall requires one trace frame";
			const duration = resolveTraceDurationMultiplier(frame, spec);
			if ("error" in duration) return duration.error;
			try {
				buildTraceModel(frame, config, preset, duration.multiplier);
				return undefined;
			} catch (error) {
				return error instanceof Error ? error.message : "Invalid trace data";
			}
		},
		load: () => import("./renderer.lazy"),
		loadPolicy: "viewport" as const,
	});
