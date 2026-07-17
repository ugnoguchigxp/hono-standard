import type {
	FieldUnitV2,
	StandardFieldConfigV2,
} from "@shared/schemas/dashboard.schema";
import { resolveThemeColor } from "../../runtime/theme";
import type { DashboardVisualizationTheme } from "../../runtime/visualization-types";
import {
	applyValueMapping,
	formatDashboardValue,
} from "../../runtime/value-format";
import type { CartesianModel, CartesianSeriesModel } from "./model";

export function formatCartesianValue(
	value: unknown,
	config: StandardFieldConfigV2,
	locale = "en-US",
	timezone = "UTC",
	type?: "number" | "time" | "string",
) {
	return formatDashboardValue(value, config, locale, timezone, type);
}

export function formatCartesianUnitLabel(unit: FieldUnitV2) {
	switch (unit.kind) {
		case "none":
			return "";
		case "short":
			return "compact number";
		case "percent":
			return "percent";
		case "bytes":
			return `bytes base ${unit.base}`;
		case "duration":
			return `duration ${unit.unit}`;
		case "rate":
			return `rate ${unit.suffix}`;
		case "currency":
			return `currency ${unit.code}`;
		case "custom":
			return `unit ${unit.suffix}`;
	}
}
export function formatCartesianDomain(
	value: number | string,
	timezone = "UTC",
	locale = "en-US",
) {
	if (typeof value === "number")
		return new Intl.DateTimeFormat(locale, {
			timeZone: timezone,
			dateStyle: "medium",
			timeStyle: "short",
		}).format(new Date(value));
	return value;
}

export function formatCartesianTimeTick(
	value: number,
	domains: Array<number | string>,
	timezone = "UTC",
	locale = "en-US",
) {
	const times = domains.filter(
		(domain): domain is number => typeof domain === "number",
	);
	let minimum = Number.POSITIVE_INFINITY;
	let maximum = Number.NEGATIVE_INFINITY;
	for (const time of times) {
		minimum = Math.min(minimum, time);
		maximum = Math.max(maximum, time);
	}
	const span = times.length > 1 ? maximum - minimum : 0;
	const options: Intl.DateTimeFormatOptions =
		span >= 2 * 24 * 60 * 60 * 1000
			? { timeZone: timezone, month: "short", day: "numeric" }
			: span >= 24 * 60 * 60 * 1000
				? {
						timeZone: timezone,
						month: "short",
						day: "numeric",
						hour: "2-digit",
					}
				: { timeZone: timezone, hour: "2-digit", minute: "2-digit" };
	return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}

export function resolveCartesianSeriesColor(
	series: CartesianSeriesModel,
	index: number,
	theme: DashboardVisualizationTheme,
) {
	const token =
		series.fieldConfig.color?.mode === "fixed"
			? series.fieldConfig.color.token
			: theme.palette.length > 0
				? theme.palette[index % theme.palette.length]
				: undefined;
	return resolveThemeColor(token);
}

export function findCartesianSeriesForDataKey(
	model: CartesianModel,
	dataKey: unknown,
) {
	if (typeof dataKey !== "string") return undefined;
	const key = dataKey.startsWith("values.")
		? dataKey.slice("values.".length)
		: dataKey;
	return model.series.find((series) => series.key === key);
}

export function formatCartesianTooltipValue(
	value: unknown,
	series: CartesianSeriesModel,
	locale: string,
	timezone: string,
) {
	const formatted = formatCartesianValue(
		value,
		series.fieldConfig,
		locale,
		timezone,
		"number",
	);
	const mapping = applyValueMapping(value, series.fieldConfig);
	return mapping
		? { value: mapping.text, detail: `raw ${formatted}` }
		: { value: formatted };
}
