import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import type { CandlestickConfig } from "@shared/schemas/dashboard/specialized-visualizations.schema";
import { fieldFor, numberAt, rowCount } from "../specialized/frame-values";
import { createNumericScale } from "../specialized/scale";

export type OhlcRow = {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume?: number;
	baseline?: number;
	series?: string;
	sourceRowCount: number;
};
export type OhlcModel = {
	rows: OhlcRow[];
	rawRows: OhlcRow[];
	scale: ReturnType<typeof createNumericScale>;
	baseline?: number;
	notices: string[];
};

function rawRows(frame: DashboardDataFrameV2): OhlcRow[] {
	const time = fieldFor(frame, "time");
	const open = fieldFor(frame, "open");
	const high = fieldFor(frame, "high");
	const low = fieldFor(frame, "low");
	const close = fieldFor(frame, "close");
	if (!time || !open || !high || !low || !close)
		throw new Error("OHLC requires time/open/high/low/close fields");
	const volume = fieldFor(frame, "volume");
	const baseline = fieldFor(frame, "baseline");
	const series = fieldFor(frame, "series");
	const rows: OhlcRow[] = [];
	const previousBySeries = new Map<string, number>();
	const seriesTimes = new Map<string, Set<number>>();
	for (let index = 0; index < rowCount(frame); index += 1) {
		const values = [
			numberAt(time, index),
			numberAt(open, index),
			numberAt(high, index),
			numberAt(low, index),
			numberAt(close, index),
		];
		if (values.some((value) => value === undefined))
			throw new Error("OHLC values must be finite");
		const [timestamp, openValue, highValue, lowValue, closeValue] =
			values as number[];
		if (Math.abs(timestamp) > 8.64e15)
			throw new Error("OHLC time is outside the supported date range");
		const seriesValue = series
			? String(series.values[index] ?? "default")
			: "default";
		if (timestamp <= (previousBySeries.get(seriesValue) ?? -Infinity))
			throw new Error("OHLC time must be unique and ascending");
		previousBySeries.set(seriesValue, timestamp);
		if (
			!(
				lowValue <= Math.min(openValue, closeValue) &&
				Math.max(openValue, closeValue) <= highValue
			)
		)
			throw new Error("OHLC invariant is invalid");
		const volumeValue = numberAt(volume, index);
		if (volumeValue !== undefined && volumeValue < 0)
			throw new Error("OHLC volume must be non-negative");
		const times = seriesTimes.get(seriesValue) ?? new Set<number>();
		if (times.has(timestamp))
			throw new Error("OHLC time must be unique within series");
		times.add(timestamp);
		seriesTimes.set(seriesValue, times);
		rows.push({
			time: timestamp,
			open: openValue,
			high: highValue,
			low: lowValue,
			close: closeValue,
			volume: volumeValue,
			baseline: numberAt(baseline, index),
			series: seriesValue,
			sourceRowCount: 1,
		});
	}
	if (seriesTimes.size > 4)
		throw new Error("OHLC supports at most four series");
	return rows;
}

export function aggregateOhlc(rows: OhlcRow[], maxVisibleBuckets: number) {
	if (rows.length <= maxVisibleBuckets) return rows;
	const bucketSize = Math.ceil(rows.length / Math.max(1, maxVisibleBuckets));
	const result: OhlcRow[] = [];
	for (let start = 0; start < rows.length; start += bucketSize) {
		const bucket = rows.slice(start, start + bucketSize);
		const first = bucket[0];
		const last = bucket[bucket.length - 1];
		if (!first || !last) continue;
		const volume = bucket.some((row) => row.volume !== undefined)
			? bucket.reduce((sum, row) => sum + (row.volume ?? 0), 0)
			: undefined;
		if (volume !== undefined && !Number.isFinite(volume))
			throw new Error("aggregated OHLC volume exceeds numeric range");
		result.push({
			time: first.time,
			open: first.open,
			high: Math.max(...bucket.map((row) => row.high)),
			low: Math.min(...bucket.map((row) => row.low)),
			close: last.close,
			volume,
			baseline: [...bucket].reverse().find((row) => row.baseline !== undefined)
				?.baseline,
			series: first.series,
			sourceRowCount: bucket.length,
		});
	}
	return result;
}

export function buildOhlcModel(
	frame: DashboardDataFrameV2,
	config: CandlestickConfig,
	maxVisibleBuckets = 400,
	preset = "candles",
	configuredDomain?: { min: number; max: number },
): OhlcModel {
	const raw = rawRows(frame);
	const seriesNames = [
		...new Set(raw.map((row) => row.series ?? "default")),
	].sort();
	if (preset === "volume" && seriesNames.length > 1)
		throw new Error("volume preset supports one OHLC series");
	const bucketsPerSeries = Math.max(
		1,
		Math.floor(maxVisibleBuckets / Math.max(1, seriesNames.length)),
	);
	const rows = seriesNames
		.flatMap((seriesName) =>
			aggregateOhlc(
				raw.filter((row) => (row.series ?? "default") === seriesName),
				bucketsPerSeries,
			),
		)
		.sort(
			(a, b) =>
				a.time - b.time || (a.series ?? "").localeCompare(b.series ?? ""),
		);
	const baseline =
		raw.find((row) => row.baseline !== undefined)?.baseline ??
		config.baseline ??
		raw[0]?.close;
	const scale = createNumericScale(
		[
			...rows.flatMap((row) => [row.low, row.high]),
			...(baseline === undefined ? [] : [baseline]),
		],
		config.yDomain === "zero",
		config.yDomain === "config" ? configuredDomain : undefined,
	);
	return {
		rows,
		rawRows: raw,
		scale,
		baseline,
		notices: rows.some((row) => row.sourceRowCount > 1)
			? ["OHLC rows aggregated to pixel density"]
			: [],
	};
}
