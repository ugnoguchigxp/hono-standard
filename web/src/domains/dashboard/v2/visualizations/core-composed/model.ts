import type { ComposedConfigV1 } from "@shared/schemas/dashboard/cartesian-visualizations.schema";
import {
	buildCartesianModel,
	inferComposedSeries,
	resolveCartesianSeriesKey,
	type CartesianModelOptions,
} from "../cartesian/model";

export function buildComposedModel(
	frames: Parameters<typeof buildCartesianModel>[0],
	config: ComposedConfigV1,
	options: CartesianModelOptions = {},
) {
	const model = buildCartesianModel(
		frames,
		frames.some((frame) =>
			frame.fields.some((field) => field.roles.includes("time")),
		)
			? "time"
			: "category",
		options,
	);
	const bindings =
		config.series.length > 0
			? config.series.map((binding) => ({
					...binding,
					fieldKey: resolveCartesianSeriesKey(model, binding.fieldKey),
				}))
			: inferComposedSeries(model);
	return {
		model,
		bindings,
	};
}
