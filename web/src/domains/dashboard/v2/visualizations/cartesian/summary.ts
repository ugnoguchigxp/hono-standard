import type { CartesianModel } from "./model";
import { formatCartesianValue } from "./formatters";
import { normalizePercentRows } from "./model";

type CartesianSummaryOptions = {
	rangeBand?: { lowerKey: string; upperKey: string };
	waterfall?: { valueKey: string };
};

export function summarizeCartesian(
	model: CartesianModel,
	preset: string,
	locale = "en-US",
	timezone = "UTC",
	options: CartesianSummaryOptions = {},
) {
	const latest = model.rows.at(-1);
	let min: number | null = null;
	let max: number | null = null;
	for (const series of model.series) {
		for (const value of series.values) {
			if (value === null) continue;
			min = min === null ? value : Math.min(min, value);
			max = max === null ? value : Math.max(max, value);
		}
	}
	const latestText = latest
		? model.series
				.map(
					(series) =>
						`${series.label} ${formatCartesianValue(latest.values[series.key], series.fieldConfig, locale, timezone, "number")}`,
				)
				.join(", ")
		: "N/A";
	const rangeConfig = model.series[0]?.fieldConfig;
	const formatRange = (value: number | null) =>
		value === null || !rangeConfig
			? "N/A"
			: formatCartesianValue(value, rangeConfig, locale, timezone, "number");
	const summarize = () => {
		if (preset.includes("percent")) {
			const composition = normalizePercentRows(model).at(-1);
			const values = model.series
				.map(
					(series) =>
						`${series.label} ${Number(composition?.values[series.key] ?? 0).toLocaleString(locale, { maximumFractionDigits: 2 })}%`,
				)
				.join(", ");
			return `${preset}: latest composition ${values}`;
		}
		if (preset === "range-band" && options.rangeBand) {
			const lowerSeries = model.series.find(
				(series) => series.key === options.rangeBand?.lowerKey,
			);
			const upperSeries = model.series.find(
				(series) => series.key === options.rangeBand?.upperKey,
			);
			const lower = latest?.values[options.rangeBand.lowerKey] ?? null;
			const upper = latest?.values[options.rangeBand.upperKey] ?? null;
			if (!lowerSeries || !upperSeries)
				return "range-band: range fields unavailable";
			const width = lower === null || upper === null ? null : upper - lower;
			return `range-band: latest ${lowerSeries.label} ${formatCartesianValue(lower, lowerSeries.fieldConfig, locale, timezone, "number")}, ${upperSeries.label} ${formatCartesianValue(upper, upperSeries.fieldConfig, locale, timezone, "number")}, width ${formatCartesianValue(width, upperSeries.fieldConfig, locale, timezone, "number")}`;
		}
		if (preset === "sparkline") {
			const series = model.series[0];
			const first = series?.values.find((value) => value !== null) ?? null;
			let last: number | null = null;
			if (series)
				for (let index = series.values.length - 1; index >= 0; index -= 1) {
					const value = series.values[index];
					if (value !== null && value !== undefined) {
						last = value;
						break;
					}
				}
			const direction =
				first === null || last === null
					? "unknown trend"
					: last > first
						? "rising"
						: last < first
							? "falling"
							: "flat";
			return `sparkline: ${series?.label ?? "series"}, first ${series ? formatCartesianValue(first, series.fieldConfig, locale, timezone, "number") : "N/A"}, latest ${series ? formatCartesianValue(last, series.fieldConfig, locale, timezone, "number") : "N/A"}, ${direction}`;
		}
		if (preset === "waterfall" && options.waterfall) {
			const series = model.series.find(
				(item) => item.key === options.waterfall?.valueKey,
			);
			const net =
				series?.values.reduce<number>((sum, value) => sum + (value ?? 0), 0) ??
				0;
			return `waterfall: start 0, net change ${series ? formatCartesianValue(net, series.fieldConfig, locale, timezone, "number") : net}, end ${series ? formatCartesianValue(net, series.fieldConfig, locale, timezone, "number") : net}`;
		}
		if (["horizontal", "lollipop"].includes(preset)) {
			const series = model.series[0];
			let minimum: { domain: string | number; value: number } | undefined;
			let maximum: { domain: string | number; value: number } | undefined;
			for (const row of model.rows) {
				const value = series ? row.values[series.key] : null;
				if (value === null || value === undefined) continue;
				if (!minimum || value < minimum.value)
					minimum = { domain: row.domain, value };
				if (!maximum || value > maximum.value)
					maximum = { domain: row.domain, value };
			}
			return `${preset}: minimum ${minimum?.domain ?? "N/A"}, maximum ${maximum?.domain ?? "N/A"}, ${model.rows.length} categories`;
		}
		if (["stacked-area", "stacked", "stacked-time-bars"].includes(preset)) {
			const total = latest
				? Object.values(latest.values).reduce<number>(
						(sum, value) => sum + (value ?? 0),
						0,
					)
				: null;
			return `${preset}: ${model.series.length} series, latest ${latestText}, total ${formatRange(total)}`;
		}
		if (preset === "grouped")
			return `grouped: ${model.rows.length} categories, ${model.series.length} series, latest ${latestText}`;
		return `${preset}: ${model.series.length} series, ${model.rows.length} points, latest ${latestText}, range ${formatRange(min)} to ${formatRange(max)}`;
	};
	return summarize().slice(0, 400);
}
