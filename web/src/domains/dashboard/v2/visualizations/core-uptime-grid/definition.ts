import {
	coreUptimeGridVisualizationContract,
	uptimeGridConfigV1Schema,
	type UptimeGridConfigV1,
} from "@shared/schemas/dashboard/state-visualizations.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { resolveFrameTimeRange } from "../state/time-range";
import { buildUptimeModel } from "../state/uptime-model";
export const coreUptimeGridDefinition =
	defineFrontendVisualization<UptimeGridConfigV1>({
		...coreUptimeGridVisualizationContract,
		validateFrames: (frames, config, preset) => {
			try {
				const frame = frames[0];
				if (!frame) return "Uptime frame is missing";
				const lane = frame.fields.find(
					(field) =>
						field.roles.includes("category") || field.roles.includes("series"),
				);
				const laneCount = new Set((lane?.values ?? ["default"]).map(String))
					.size;
				if (preset === "service-matrix" && laneCount < 2)
					return "Service matrix requires at least two lanes";
				const queryRange = resolveFrameTimeRange(frame, undefined, 1);
				const range =
					config.range === "query"
						? queryRange
						: {
								from: Math.max(
									queryRange.from,
									queryRange.to - config.range.rollingDays * 86_400_000,
								),
								to: queryRange.to,
							};
				buildUptimeModel({
					frame,
					range,
					timezone: "UTC",
					bucket: config.bucket,
					minimumCoveragePercent: config.minimumCoveragePercent,
				});
			} catch (error) {
				return error instanceof Error ? error.message : "Invalid uptime data";
			}
			if (config.range !== "query" && config.range.rollingDays > 365)
				return "Rolling range exceeds limit";
			return undefined;
		},
		validateResolvedFrames: (_frames, _config, preset, spec) =>
			preset === "incident-overlay" &&
			!(spec.annotationLayers ?? []).some((layer) => layer.enabled)
				? "Incident overlay requires an enabled annotation layer"
				: undefined,
		configSchema: uptimeGridConfigV1Schema,
		load: () => import("./renderer.lazy"),
		loadPolicy: "viewport",
	});
