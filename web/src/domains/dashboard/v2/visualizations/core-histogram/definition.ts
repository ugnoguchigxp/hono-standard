import {
	coreHistogramVisualizationContract,
	type HistogramConfigV1,
	histogramConfigV1Schema,
} from "@shared/schemas/dashboard/distribution-visualizations.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { buildHistogramModel } from "../distribution/histogram";
export const histogramConfigSchema = histogramConfigV1Schema;
export const coreHistogramDefinition =
	defineFrontendVisualization<HistogramConfigV1>({
		...coreHistogramVisualizationContract,
		validateFrames: (frames, config) => {
			const frame = frames[0];
			if (!frame) return "Histogram data frame is missing";
			const preBinned =
				frame.fields.some((field) => field.roles.includes("bin-start")) &&
				frame.fields.some((field) => field.roles.includes("bin-end")) &&
				frame.fields.some((field) => field.roles.includes("count"));
			if (!preBinned)
				return "Raw histogram input requires the core.histogram browser transformation";
			try {
				const model = buildHistogramModel(frame);
				if (model.rows.length > 100)
					return "Histogram supports at most 100 bins";
				if (
					config.xScale.mode === "log" &&
					model.rows.some((row) => row.start <= 0)
				)
					return "Histogram log scale requires positive bins";
				const domainMin =
					typeof config.xScale.min === "number"
						? config.xScale.min
						: Number.NEGATIVE_INFINITY;
				const domainMax =
					typeof config.xScale.max === "number"
						? config.xScale.max
						: Number.POSITIVE_INFINITY;
				if (
					model.rows.length > 0 &&
					model.rows.every(
						(row) => row.end <= domainMin || row.start >= domainMax,
					)
				)
					return "Histogram scale domain excludes every bin";
			} catch (error) {
				return error instanceof Error
					? error.message
					: "Invalid histogram data";
			}
			return undefined;
		},
		load: () => import("./renderer.lazy"),
		loadPolicy: "viewport",
	});
