import type { BoxPlotConfigV1 } from "@shared/schemas/dashboard/distribution-visualizations.schema";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { quantileR7 } from "./bins";

export type BoxDatum = {
	id: string;
	category: string;
	series?: string;
	min: number;
	q1: number;
	median: number;
	q3: number;
	max: number;
	whiskerLow: number;
	whiskerHigh: number;
	outliers: number[];
	points: number[];
	mean?: number;
	count: number;
};
export function buildBoxDatum(
	values: readonly number[],
	category: string,
	series?: string,
	id = category,
) {
	const points = values.filter(Number.isFinite).sort((a, b) => a - b);
	if (points.length < 2) throw new Error("BOX_REQUIRES_TWO_VALUES");
	const q1 = quantileR7(points, 0.25);
	const median = quantileR7(points, 0.5);
	const q3 = quantileR7(points, 0.75);
	const first = points[0];
	const last = points.at(-1);
	if (
		q1 === null ||
		median === null ||
		q3 === null ||
		first === undefined ||
		last === undefined
	)
		throw new Error("BOX_VALUES_MISSING");
	const iqr = q3 - q1;
	const low = q1 - 1.5 * iqr;
	const high = q3 + 1.5 * iqr;
	const inliers = points.filter((value) => value >= low && value <= high);
	return {
		id,
		category,
		series,
		min: first,
		q1,
		median,
		q3,
		max: last,
		whiskerLow: Math.min(...inliers),
		whiskerHigh: Math.max(...inliers),
		outliers: points.filter((value) => value < low || value > high),
		points,
		mean: points.reduce((sum, value) => sum + value / points.length, 0),
		count: points.length,
	} satisfies BoxDatum;
}
const roleValue = (frame: DashboardDataFrameV2, role: string, key?: string) =>
	frame.fields.find((item) =>
		key ? item.key === key : item.roles.includes(role as never),
	);
export function buildBoxPlotModel(
	frames: DashboardDataFrameV2[],
	config: BoxPlotConfigV1,
	_preset: string,
): BoxDatum[] {
	const frame = frames[0];
	if (!frame) return [];
	if (config.inputMode === "summary") {
		const categoryField =
			roleValue(frame, "category") ??
			frame.fields.find((item) => item.type === "string");
		const seriesField = roleValue(frame, "series");
		const summaryFields = ["min", "q1", "median", "q3", "max"].map((role) =>
			roleValue(frame, role),
		);
		if (summaryFields.some((item) => !item) || !categoryField)
			throw new Error("BOX_SUMMARY_FIELDS_MISSING");
		const seen = new Set<string>();
		const categories = new Set<string>();
		const seriesValues = new Set<string>();
		const result = categoryField.values.flatMap((category, row) => {
			if (category === null) return [];
			const values = summaryFields.map((field) => field?.values[row]);
			if (
				values.some(
					(value) => typeof value !== "number" || !Number.isFinite(value),
				)
			)
				throw new Error("BOX_SUMMARY_VALUE_MISSING");
			const [min, q1, median, q3, max] = values as number[];
			if (!(min <= q1 && q1 <= median && median <= q3 && q3 <= max))
				throw new Error("BOX_FIVE_NUMBER_ORDER");
			const categoryLabel = String(category);
			const seriesLabel =
				seriesField?.values[row] == null
					? undefined
					: String(seriesField.values[row]);
			const id = JSON.stringify([categoryLabel, seriesLabel ?? null]);
			if (seen.has(id)) throw new Error("BOX_SUMMARY_DUPLICATE");
			seen.add(id);
			categories.add(categoryLabel);
			if (seriesLabel) seriesValues.add(seriesLabel);
			return [
				{
					id,
					category: categoryLabel,
					series: seriesLabel,
					min,
					q1,
					median,
					q3,
					max,
					whiskerLow: min,
					whiskerHigh: max,
					outliers: [],
					points: [],
					count: 0,
				} satisfies BoxDatum,
			];
		});
		if (categories.size > 40) throw new Error("BOX_CATEGORY_LIMIT");
		if (seriesValues.size > 8) throw new Error("BOX_SERIES_LIMIT");
		return result;
	}
	const categoryField = roleValue(frame, "category");
	const seriesField = roleValue(frame, "series");
	const valueField = roleValue(frame, "value");
	if (valueField?.type !== "number") throw new Error("BOX_RAW_FIELDS_MISSING");
	const groups = new Map<
		string,
		{ category: string; series?: string; values: number[] }
	>();
	const categories = new Set<string>();
	const seriesValues = new Set<string>();
	let pointCount = 0;
	for (let row = 0; row < valueField.values.length; row += 1) {
		const category = String(categoryField?.values[row] ?? "All");
		const series =
			seriesField?.values[row] == null
				? undefined
				: String(seriesField.values[row]);
		const value = valueField.values[row];
		if (typeof value !== "number" || !Number.isFinite(value)) continue;
		pointCount += 1;
		if (pointCount > 2_000) throw new Error("BOX_VALUE_LIMIT");
		categories.add(category);
		if (series) seriesValues.add(series);
		const key = JSON.stringify([category, series ?? null]);
		const group = groups.get(key);
		if (group) group.values.push(value);
		else groups.set(key, { category, series, values: [value] });
	}
	if (categories.size > 40) throw new Error("BOX_CATEGORY_LIMIT");
	if (seriesValues.size > 8) throw new Error("BOX_SERIES_LIMIT");
	return [...groups.entries()].map(([key, group]) =>
		buildBoxDatum(group.values, group.category, group.series, key),
	);
}
export function stableJitter(id: string, index: number, amount: number) {
	let hash = 2166136261;
	for (const character of `${id}:${index}`)
		hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
	return ((((hash >>> 0) % 10_000) / 10_000) * 2 - 1) * amount;
}
