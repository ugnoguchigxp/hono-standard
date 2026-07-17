import {
	coreFunnelVisualizationContract,
	funnelConfigV1Schema,
	type FunnelConfigV1,
} from "@shared/schemas/dashboard/composition-visualizations.schema";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { buildCategoryCompositionModel } from "../composition/category-model";

export const coreFunnelDefinition = defineFrontendVisualization({
	...coreFunnelVisualizationContract,
	configSchema: funnelConfigV1Schema,
	validateFrames: (frames: DashboardDataFrameV2[], config: FunnelConfigV1) => {
		try {
			const model = buildCategoryCompositionModel(
				frames[0] as DashboardDataFrameV2,
				["--color-brand"],
			);
			if (model.slices.length < 2 || model.slices.length > 20)
				return "Funnel requires 2 to 20 stages";
			if (!(model.slices[0]?.value > 0))
				return "Funnel first stage must be positive";
			if (
				config.enforceMonotonic &&
				model.slices.some(
					(slice, index) =>
						index > 0 && slice.value > (model.slices[index - 1]?.value ?? 0),
				)
			)
				return "Funnel stages must be non-increasing";
			return undefined;
		} catch (error) {
			return error instanceof Error ? error.message : "Invalid funnel data";
		}
	},
	load: () => import("./renderer.lazy"),
	loadPolicy: "viewport" as const,
});
