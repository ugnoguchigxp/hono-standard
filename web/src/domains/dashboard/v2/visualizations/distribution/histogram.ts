import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";

export type HistogramSeriesMetric = {
	count: number;
	density: number;
	probability: number;
};

export type HistogramModelSeries = {
	key: string;
	label: string;
	total: number;
};

export type HistogramModelRow = {
	start: number;
	end: number;
	label: string;
	series: Record<string, HistogramSeriesMetric>;
	totalCount: number;
	density: number;
	probability: number;
	cumulativeCount: number;
	cumulativeProbability: number;
};

export type HistogramModel = {
	rows: HistogramModelRow[];
	series: HistogramModelSeries[];
	total: number;
};

type InputBin = {
	start: number;
	end: number;
	count: number;
};

const numericRole = (frame: DashboardDataFrameV2, role: string) =>
	frame.fields.find(
		(field) => field.type === "number" && field.roles.includes(role as never),
	);

const intervalLabel = (start: number, end: number, locale: string) =>
	`${start.toLocaleString(locale, { maximumFractionDigits: 6 })}–${end.toLocaleString(locale, { maximumFractionDigits: 6 })}`;

export function buildHistogramModel(
	frame: DashboardDataFrameV2,
	locale = "en-US",
): HistogramModel {
	const startField = numericRole(frame, "bin-start");
	const endField = numericRole(frame, "bin-end");
	const countField = numericRole(frame, "count");
	if (!startField || !endField || !countField)
		throw new Error("HISTOGRAM_FIELDS_MISSING");
	const rowCount = startField.values.length;
	if (
		endField.values.length !== rowCount ||
		countField.values.length !== rowCount
	)
		throw new Error("HISTOGRAM_FIELD_LENGTH_MISMATCH");
	const seriesField = frame.fields.find((field) =>
		field.roles.includes("series"),
	);
	if (seriesField && seriesField.values.length !== rowCount)
		throw new Error("HISTOGRAM_FIELD_LENGTH_MISMATCH");

	const grouped = new Map<string, InputBin[]>();
	for (let row = 0; row < rowCount; row += 1) {
		const start = startField.values[row];
		const end = endField.values[row];
		const count = countField.values[row];
		if (
			typeof start !== "number" ||
			typeof end !== "number" ||
			typeof count !== "number"
		)
			throw new Error("HISTOGRAM_VALUE_MISSING");
		if (
			!Number.isFinite(start) ||
			!Number.isFinite(end) ||
			!Number.isFinite(count)
		)
			throw new Error("HISTOGRAM_VALUE_NOT_FINITE");
		if (end <= start || !Number.isFinite(end - start))
			throw new Error("HISTOGRAM_BIN_ORDER");
		if (count < 0 || !Number.isInteger(count))
			throw new Error("HISTOGRAM_COUNT_INVALID");
		const series = seriesField
			? String(seriesField.values[row] ?? "(none)")
			: "All";
		const bins = grouped.get(series);
		if (bins) bins.push({ start, end, count });
		else grouped.set(series, [{ start, end, count }]);
	}
	if (grouped.size > 12) throw new Error("HISTOGRAM_SERIES_LIMIT");

	for (const bins of grouped.values()) {
		for (let index = 1; index < bins.length; index += 1) {
			const previous = bins[index - 1];
			const current = bins[index];
			if (!previous || !current) continue;
			if (current.start < previous.start)
				throw new Error("HISTOGRAM_BINS_UNSORTED");
			if (current.start < previous.end)
				throw new Error("HISTOGRAM_BINS_OVERLAP");
		}
	}

	const groupedEntries = [...grouped.entries()];
	const baseline = groupedEntries[0]?.[1] ?? [];
	const boundarySignature = (bins: readonly InputBin[]) =>
		bins.map((bin) => `${bin.start}:${bin.end}`).join("|");
	if (
		groupedEntries.some(
			([, bins]) => boundarySignature(bins) !== boundarySignature(baseline),
		)
	)
		throw new Error("HISTOGRAM_SERIES_BOUNDARIES_MISALIGNED");

	const series = groupedEntries.map(([label, bins], index) => ({
		key: `series-${index}`,
		label,
		total: bins.reduce((sum, bin) => sum + bin.count, 0),
	}));
	const total = series.reduce((sum, item) => sum + item.total, 0);
	let cumulativeCount = 0;
	const rows = baseline.map((bin, binIndex) => {
		const width = bin.end - bin.start;
		const metrics: Record<string, HistogramSeriesMetric> = {};
		let totalCount = 0;
		for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex += 1) {
			const descriptor = series[seriesIndex];
			const source = groupedEntries[seriesIndex]?.[1][binIndex];
			if (!descriptor || !source) continue;
			totalCount += source.count;
			metrics[descriptor.key] = {
				count: source.count,
				density:
					descriptor.total > 0 ? source.count / descriptor.total / width : 0,
				probability: descriptor.total > 0 ? source.count / descriptor.total : 0,
			};
		}
		cumulativeCount += totalCount;
		return {
			start: bin.start,
			end: bin.end,
			label: intervalLabel(bin.start, bin.end, locale),
			series: metrics,
			totalCount,
			density: total > 0 ? totalCount / total / width : 0,
			probability: total > 0 ? totalCount / total : 0,
			cumulativeCount,
			cumulativeProbability: total > 0 ? cumulativeCount / total : 0,
		};
	});
	return { rows, series, total };
}
