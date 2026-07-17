import {
	barConfigV2Schema,
	coreBarVisualizationContract,
	type BarConfigV2,
} from "@shared/schemas/dashboard/cartesian-visualizations.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import {
	validateCartesianDomains,
	validateCartesianUnitAxes,
} from "../cartesian/validation";

export const barConfigSchema = barConfigV2Schema;

export const coreBarDefinition = defineFrontendVisualization({
	...coreBarVisualizationContract,
	validateFrames: (frames, config, preset) => {
		const domainError = validateCartesianDomains(
			frames,
			preset.includes("time") ? "time" : "category",
		);
		if (domainError) return domainError;
		const series = frames.flatMap((frame) =>
			frame.fields.filter(
				(field) => field.type === "number" && field.roles.includes("value"),
			),
		);
		if (series.length === 0)
			return "At least one numeric value series is required";
		if (series.length > 20) return "Bar charts support at most 20 series";
		if (
			["grouped", "stacked", "percent-stacked", "stacked-time-bars"].includes(
				preset,
			) &&
			series.length < 2
		)
			return `${preset} requires at least two value series`;
		if (["lollipop", "waterfall"].includes(preset) && series.length !== 1)
			return `${preset} requires exactly one value series`;
		if (
			preset === "waterfall" &&
			config.waterfall.valueFieldKey &&
			series[0]?.key !== config.waterfall.valueFieldKey
		)
			return "Waterfall value field binding is missing";
		const values = series.flatMap((field) =>
			field.values.filter((value): value is number => value !== null),
		);
		if (preset === "percent-stacked" && values.some((value) => value < 0))
			return "Percent stacked bar requires non-negative values";
		if (
			preset === "percent-stacked" &&
			(config.valueAxis.min !== "auto" || config.valueAxis.max !== "auto")
		)
			return "Percent stacked bar requires an automatic 0 to 100 axis";
		if (preset === "percent-stacked" && config.valueAxis.scale === "log")
			return "Percent stacked bar requires a linear value axis";
		if (preset === "waterfall" && config.valueAxis.scale === "log")
			return "Waterfall requires a linear value axis";
		if (config.valueAxis.scale === "log" && values.some((value) => value <= 0))
			return "Log scale requires positive values";
		return undefined;
	},
	validateResolvedFrames: (frames, _config, preset, spec) => {
		if (spec.annotationLayers?.length && !preset.includes("time"))
			return "Annotations require a time bar preset";
		return validateCartesianUnitAxes(spec, [
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
		]);
	},
	load: () => import("./renderer.lazy"),
	loadPolicy: "immediate",
});

export type { BarConfigV2 };
