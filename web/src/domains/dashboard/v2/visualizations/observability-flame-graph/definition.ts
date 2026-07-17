import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { observabilityFlameVisualizationContract } from "@shared/schemas/dashboard/specialized-visualizations.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { buildProfileModel } from "../profile/profile-model";
export const observabilityFlameGraphDefinition = defineFrontendVisualization({
	...observabilityFlameVisualizationContract,
	validateFrames: (frames: DashboardDataFrameV2[], _config, preset) => {
		const frame = frames[0];
		if (!frame || frames.length !== 1)
			return "Flame graph requires one profile frame";
		if (
			preset === "differential" &&
			!frame.fields.some(
				(field) =>
					field.roles.includes("delta") &&
					field.values.every(
						(value) => typeof value === "number" && Number.isFinite(value),
					),
			)
		)
			return "Differential preset requires delta";
		if (
			preset === "category-colored" &&
			!frame.fields.some(
				(field) =>
					field.roles.includes("category") &&
					field.values.every(
						(value) => typeof value === "string" && value.length > 0,
					),
			)
		)
			return "Category-colored preset requires category";
		try {
			buildProfileModel(frame, preset);
			return undefined;
		} catch (error) {
			return error instanceof Error ? error.message : "Invalid profile data";
		}
	},
	load: () => import("./renderer.lazy"),
	loadPolicy: "viewport" as const,
});
