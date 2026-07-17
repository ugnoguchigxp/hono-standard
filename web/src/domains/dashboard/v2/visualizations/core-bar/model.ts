import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { buildCartesianModel } from "../cartesian/model";

export function categorySeries(frames: DashboardDataFrameV2[]) {
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
export function toCategoryRows(frames: DashboardDataFrameV2[]) {
	const model = buildCartesianModel(frames, "category");
	return model.rows.map((row) => ({ category: row.domain, ...row.values }));
}
