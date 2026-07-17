import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";

export type NumericTimeRange = { from: number; to: number };

export function resolveFrameTimeRange(
	frame: DashboardDataFrameV2,
	resolvedRange: NumericTimeRange | undefined,
	tailMs = 1,
): NumericTimeRange {
	if (
		resolvedRange &&
		Number.isSafeInteger(resolvedRange.from) &&
		Number.isSafeInteger(resolvedRange.to) &&
		resolvedRange.from < resolvedRange.to
	)
		return resolvedRange;
	const field = frame.fields.find(
		(item) => item.roles.includes("time") || item.roles.includes("start-time"),
	);
	const values =
		field?.values.filter(
			(value): value is number =>
				typeof value === "number" && Number.isSafeInteger(value),
		) ?? [];
	if (values.length === 0) return { from: 0, to: Math.max(1, tailMs) };
	const from = Math.min(...values);
	const last = Math.max(...values);
	return { from, to: Math.max(from + 1, last + Math.max(1, tailMs)) };
}
