import {
	coreHistogramTransformationContract,
	type HistogramTransformationConfigV1,
	histogramTransformationConfigV1Schema,
} from "@shared/schemas/dashboard/histogram-transformation.schema";
import type {
	DashboardDataFrameV2,
	DashboardFieldRole,
} from "@shared/schemas/dashboard.schema";
import type { AnyFrontendTransformationDefinition } from "../runtime/transformation-types";
import {
	binValues,
	chooseBinCount,
	type HistogramBin,
} from "../visualizations/distribution/bins";

const numericField = (frame: DashboardDataFrameV2, key?: string) =>
	frame.fields.find(
		(field) =>
			field.type === "number" &&
			(key ? field.key === key : field.roles.includes("value")),
	);
const seriesField = (frame: DashboardDataFrameV2, key?: string) =>
	frame.fields.find(
		(field) =>
			field.type === "string" &&
			(key ? field.key === key : field.roles.includes("series")),
	);
const numberOutputField = (
	key: string,
	label: string,
	values: number[],
	roles: DashboardFieldRole[],
) => ({ key, label, type: "number" as const, values, roles, labels: {} });
const stringOutputField = (
	key: string,
	label: string,
	values: string[],
	roles: DashboardFieldRole[],
) => ({ key, label, type: "string" as const, values, roles, labels: {} });

export function transformHistogram(
	frame: DashboardDataFrameV2,
	config: HistogramTransformationConfigV1,
) {
	const values = numericField(frame, config.valueFieldKey);
	if (!values) throw new Error("HISTOGRAM_VALUE_FIELD_MISSING");
	const series = seriesField(frame, config.seriesFieldKey);
	const groups = new Map<string, number[]>();
	const acceptedValues: number[] = [];
	for (let row = 0; row < values.values.length; row += 1) {
		const value = values.values[row];
		if (typeof value !== "number") continue;
		acceptedValues.push(value);
		if (acceptedValues.length > 2_000) throw new Error("HISTOGRAM_VALUE_LIMIT");
		const key = series ? String(series.values[row] ?? "(none)") : "All";
		const group = groups.get(key);
		if (group) group.push(value);
		else groups.set(key, [value]);
	}
	if (groups.size > 12) throw new Error("HISTOGRAM_SERIES_LIMIT");
	const dataMin = acceptedValues.reduce(
		(current, value) => Math.min(current, value),
		Number.POSITIVE_INFINITY,
	);
	const dataMax = acceptedValues.reduce(
		(current, value) => Math.max(current, value),
		Number.NEGATIVE_INFINITY,
	);
	const range =
		config.range === "data"
			? acceptedValues.length
				? { min: dataMin, max: dataMax }
				: undefined
			: config.range;
	const binning =
		config.binning.mode === "fixed-width"
			? config.binning
			: {
					mode: "fixed-count" as const,
					count: chooseBinCount(acceptedValues, config.binning),
				};
	const hasUnderflow = range
		? acceptedValues.some((value) => value < range.min)
		: false;
	const hasOverflow = range
		? acceptedValues.some((value) => value > range.max)
		: false;
	if ((hasUnderflow || hasOverflow) && !config.includeOutOfRange)
		throw new Error("HISTOGRAM_VALUE_OUT_OF_RANGE");
	const rows: Array<HistogramBin & { series: string }> = [];
	for (const [name, group] of groups) {
		const bins = binValues(group, binning, range);
		const min = range?.min ?? dataMin;
		const max = range?.max ?? dataMax;
		for (const bin of bins) {
			const bounded =
				config.range === "data"
					? bin
					: {
							...bin,
							start: Math.max(bin.start, min),
							end: Math.min(bin.end, max),
						};
			if (bounded.end > bounded.start) rows.push({ ...bounded, series: name });
		}
		if ((hasUnderflow || hasOverflow) && config.includeOutOfRange) {
			const overflowWidth = Math.max(max - min, 1);
			if (hasUnderflow)
				rows.push({
					start: min - overflowWidth,
					end: min,
					count: group.filter((value) => value < min).length,
					series: name,
				});
			if (hasOverflow)
				rows.push({
					start: max,
					end: max + overflowWidth,
					count: group.filter((value) => value > max).length,
					series: name,
				});
		}
	}
	rows.sort(
		(a, b) =>
			a.start - b.start ||
			(a.series < b.series ? -1 : a.series > b.series ? 1 : 0),
	);
	return {
		name: `${frame.name} histogram`,
		meta: { shapeHint: "distribution" as const, queryId: frame.meta.queryId },
		fields: [
			numberOutputField(
				"bin-start",
				"Bin start",
				rows.map((row) => row.start),
				["bin-start"],
			),
			numberOutputField(
				"bin-end",
				"Bin end",
				rows.map((row) => row.end),
				["bin-end"],
			),
			numberOutputField(
				"count",
				"Count",
				rows.map((row) => row.count),
				["count"],
			),
			...(series
				? [
						stringOutputField(
							"series",
							"Series",
							rows.map((row) => row.series),
							["series"],
						),
					]
				: []),
		],
	};
}

export const coreHistogramTransformation: AnyFrontendTransformationDefinition =
	{
		...coreHistogramTransformationContract,
		configSchema: histogramTransformationConfigV1Schema,
		execute: (_context, frames, config) => {
			const frame = frames[0];
			if (!frame) throw new Error("HISTOGRAM_INPUT_MISSING");
			return {
				frame: transformHistogram(
					frame,
					config as HistogramTransformationConfigV1,
				),
			};
		},
	};
