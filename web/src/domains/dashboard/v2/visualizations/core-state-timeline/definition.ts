import {
	coreStateTimelineVisualizationContract,
	stateTimelineConfigV1Schema,
	type StateTimelineConfigV1,
} from "@shared/schemas/dashboard/state-visualizations.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { buildStateIntervals } from "../state/interval-model";
import { resolveFrameTimeRange } from "../state/time-range";
export const coreStateTimelineDefinition =
	defineFrontendVisualization<StateTimelineConfigV1>({
		...coreStateTimelineVisualizationContract,
		validateFrames: (frames, config, preset) => {
			try {
				const frame = frames[0];
				if (!frame) return "State interval frame is missing";
				if (
					preset === "single-lane" &&
					new Set(
						(
							frame.fields.find((field) => field.roles.includes("category"))
								?.values ?? ["default"]
						).map(String),
					).size !== 1
				)
					return "Single lane preset requires one lane";
				if (
					preset === "multi-lane" &&
					new Set(
						(
							frame.fields.find((field) => field.roles.includes("category"))
								?.values ?? ["default"]
						).map(String),
					).size < 2
				)
					return "Multi lane preset requires at least two lanes";
				if (
					preset === "threshold-derived" &&
					frame.meta.shapeHint !== "state-sample"
				)
					return "Threshold derived preset requires state samples";
				const model = buildStateIntervals(frame, {
					range: resolveFrameTimeRange(
						frame,
						undefined,
						config.expectedCadenceMs,
					),
					...config,
				});
				if (model.intervals.length === 0) return "State timeline is empty";
			} catch (error) {
				return error instanceof Error
					? error.message
					: "Invalid state intervals";
			}
			return undefined;
		},
		configSchema: stateTimelineConfigV1Schema,
		load: () => import("./renderer.lazy"),
		loadPolicy: "viewport",
	});
