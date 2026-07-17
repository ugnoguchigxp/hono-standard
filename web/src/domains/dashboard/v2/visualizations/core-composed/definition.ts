import {
	composedConfigV1Schema,
	coreComposedVisualizationContract,
	type ComposedConfigV1,
} from "@shared/schemas/dashboard/cartesian-visualizations.schema";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import {
	validateCartesianDomains,
	validateCartesianUnitAxes,
} from "../cartesian/validation";

function composedFields(frames: DashboardDataFrameV2[]) {
	return frames.flatMap((frame) =>
		frame.fields
			.filter(
				(field) => field.type === "number" && field.roles.includes("value"),
			)
			.map((field) => ({
				frame,
				field,
				key: frames.length > 1 ? `${frame.refId}:${field.key}` : field.key,
			})),
	);
}

export const composedConfigSchema = composedConfigV1Schema;
export const coreComposedDefinition = defineFrontendVisualization({
	...coreComposedVisualizationContract,
	validateFrames: (
		frames: DashboardDataFrameV2[],
		config: ComposedConfigV1,
	) => {
		const domainError = validateCartesianDomains(
			frames,
			frames.some((frame) =>
				frame.fields.some((field) => field.roles.includes("time")),
			)
				? "time"
				: "category",
		);
		if (domainError) return domainError;
		const fields = composedFields(frames);
		if (fields.length < 2)
			return "Dual-axis requires at least two numeric series";
		if (fields.length > 16)
			return "Dual-axis supports at most 16 numeric series";
		const bindings =
			config.series.length > 0
				? config.series
				: fields.map(({ key }, index) => ({
						fieldKey: key,
						mark: index === 0 ? ("bar" as const) : ("line" as const),
						axis: index === 0 ? ("left" as const) : ("right" as const),
						lineStyle: "linear" as const,
					}));
		if (
			!bindings.some((item) => item.axis === "left") ||
			!bindings.some((item) => item.axis === "right")
		)
			return "Dual-axis requires both axes";
		const resolvedBindings: Array<{
			binding: (typeof bindings)[number];
			field: (typeof fields)[number]["field"];
		}> = [];
		for (const binding of bindings) {
			const matches = fields.filter(
				(item) =>
					item.key === binding.fieldKey || item.field.key === binding.fieldKey,
			);
			if (matches.length === 0) return "Dual-axis field binding is missing";
			if (matches.length > 1) return "Dual-axis field binding is ambiguous";
			const match = matches[0];
			if (!match) return "Dual-axis field binding is missing";
			resolvedBindings.push({ binding, field: match.field });
		}
		for (const axis of ["left", "right"] as const) {
			const axisConfig = axis === "left" ? config.leftAxis : config.rightAxis;
			if (
				axisConfig.scale === "log" &&
				resolvedBindings
					.filter(({ binding }) => binding.axis === axis)
					.some(({ field }) =>
						field.values.some(
							(value) => typeof value === "number" && value <= 0,
						),
					)
			)
				return `Dual-axis ${axis} log scale requires positive values`;
		}
		return undefined;
	},
	validateResolvedFrames: (frames, config, _preset, spec) => {
		const fields = composedFields(frames);
		const bindings =
			config.series.length > 0
				? config.series
				: fields.map(({ key }, index) => ({
						fieldKey: key,
						mark: index === 0 ? ("bar" as const) : ("line" as const),
						axis: index === 0 ? ("left" as const) : ("right" as const),
						lineStyle: "linear" as const,
					}));
		return validateCartesianUnitAxes(
			spec,
			(["left", "right"] as const).map((axis) => ({
				label: axis,
				fields: bindings
					.filter((binding) => binding.axis === axis)
					.map((binding) =>
						fields.find(
							(item) =>
								item.key === binding.fieldKey ||
								item.field.key === binding.fieldKey,
						),
					)
					.filter((item): item is (typeof fields)[number] => item !== undefined)
					.map(({ frame, field }) => ({ frame, field })),
			})),
		);
	},
	load: () => import("./renderer.lazy"),
	loadPolicy: "immediate",
});
