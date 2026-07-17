import {
	coreTimeseriesVisualizationContract,
	timeseriesConfigV2Schema,
} from "@shared/schemas/dashboard/cartesian-visualizations.schema";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import {
	validateCartesianDomains,
	validateCartesianUnitAxes,
} from "../cartesian/validation";

export const timeseriesConfigSchema = timeseriesConfigV2Schema;

function numericValues(frames: DashboardDataFrameV2[]) {
	return frames.flatMap((frame) =>
		frame.fields
			.filter(
				(field) => field.type === "number" && field.roles.includes("value"),
			)
			.flatMap((field) =>
				field.values.filter((value): value is number => value !== null),
			),
	);
}

export const coreTimeseriesDefinition = defineFrontendVisualization({
	...coreTimeseriesVisualizationContract,
	validateFrames: (frames, config, preset) => {
		const domainError = validateCartesianDomains(frames, "time");
		if (domainError) return domainError;
		const series = frames.flatMap((frame) =>
			frame.fields.filter(
				(field) => field.type === "number" && field.roles.includes("value"),
			),
		);
		if (series.length === 0)
			return "At least one numeric value series is required";
		if (series.length > 20) return "Time series supports at most 20 series";
		if (
			["stacked-area", "percent-stacked-area"].includes(preset) &&
			series.length < 2
		)
			return "Stacked area requires at least two value series";
		if (preset === "sparkline" && series.length !== 1)
			return "Sparkline requires exactly one value series";
		if (preset === "range-band") {
			if (!config.rangeBand) return "Range band field bindings are required";
			const fields = frames.flatMap((frame) =>
				frame.fields.map((field) => ({ frame, field })),
			);
			const lowerMatches = fields.filter(
				({ field }) => field.key === config.rangeBand?.lowerFieldKey,
			);
			const upperMatches = fields.filter(
				({ field }) => field.key === config.rangeBand?.upperFieldKey,
			);
			if (lowerMatches.length === 0 || upperMatches.length === 0)
				return "Range band fields are missing";
			if (lowerMatches.length > 1 || upperMatches.length > 1)
				return "Range band field bindings are ambiguous";
			const lower = lowerMatches[0];
			const upper = upperMatches[0];
			if (!lower || !upper) return "Range band fields are missing";
			if (lower.frame !== upper.frame)
				return "Range band fields must belong to the same frame";
			if (
				lower.field.type !== "number" ||
				upper.field.type !== "number" ||
				!lower.field.roles.includes("value") ||
				!upper.field.roles.includes("value")
			)
				return "Range band fields must be numeric";
			const valuesByTime = (binding: typeof lower) => {
				const time = binding.frame.fields.find((field) =>
					field.roles.includes("time"),
				);
				if (!time) return undefined;
				return new Map(
					time.values.map((value, index) => [
						String(value),
						binding.field.type === "number"
							? (binding.field.values[index] ?? null)
							: null,
					]),
				);
			};
			const lowerValues = valuesByTime(lower);
			const upperValues = valuesByTime(upper);
			if (!lowerValues || !upperValues)
				return "Range band requires time domains";
			for (const [time, lo] of lowerValues) {
				const hi = upperValues.get(time);
				if (lo !== null && hi !== undefined && hi !== null && lo > hi)
					return "Range band lower must not exceed upper";
			}
		}
		const values = numericValues(frames);
		if (
			preset === "percent-stacked-area" &&
			(config.valueAxis.min !== "auto" || config.valueAxis.max !== "auto")
		)
			return "Percent stacked area requires an automatic 0 to 100 axis";
		if (preset === "percent-stacked-area" && values.some((value) => value < 0))
			return "Percent stacked area requires non-negative values";
		if (
			["percent-stacked-area", "range-band"].includes(preset) &&
			config.valueAxis.scale === "log"
		)
			return `${preset} requires a linear value axis`;
		if (config.valueAxis.scale === "log" && values.some((value) => value <= 0))
			return "Log scale requires positive values";
		return undefined;
	},
	validateResolvedFrames: (frames, _config, _preset, spec) =>
		validateCartesianUnitAxes(spec, [
			{
				label: "value",
				fields: frames.flatMap((frame) =>
					frame.fields
						.filter(
							(field) =>
								field.type === "number" && field.roles.includes("value"),
						)
						.map((field) => ({ frame, field })),
				),
			},
		]),
	load: () => import("./renderer.lazy"),
	loadPolicy: "immediate",
});
