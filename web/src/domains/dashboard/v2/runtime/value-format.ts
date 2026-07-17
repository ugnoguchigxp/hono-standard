import type { StandardFieldConfigV2 } from "@shared/schemas/dashboard.schema";

const numberFormat = (
	value: number,
	decimals: "auto" | number,
	locale: string,
) =>
	new Intl.NumberFormat(locale, {
		maximumFractionDigits: decimals === "auto" ? 2 : decimals,
		minimumFractionDigits: decimals === "auto" ? 0 : decimals,
	}).format(value);
export function formatDashboardValue(
	value: unknown,
	config: StandardFieldConfigV2,
	locale = "en-US",
	timezone = "UTC",
	fieldType?: "number" | "string" | "boolean" | "time" | "json",
): string {
	if (value === null || value === undefined || value === "")
		return config.noValueText;
	if (fieldType === "time") {
		const date = new Date(value as string | number);
		if (Number.isFinite(date.getTime()))
			return new Intl.DateTimeFormat(locale, {
				dateStyle: "medium",
				timeStyle: "medium",
				timeZone: timezone,
			}).format(date);
	}
	if (typeof value === "number" && Number.isFinite(value)) {
		const unit = config.unit;
		let formatted = numberFormat(value, config.decimals, locale);
		if (unit.kind === "percent")
			formatted = `${numberFormat(unit.scale === "unit" ? value * 100 : value, config.decimals, locale)}%`;
		if (unit.kind === "bytes")
			formatted = formatBytes(value, unit.base, locale, config.decimals);
		if (unit.kind === "currency")
			formatted = new Intl.NumberFormat(locale, {
				style: "currency",
				currency: unit.code,
				maximumFractionDigits: config.decimals === "auto" ? 2 : config.decimals,
			}).format(value);
		if (unit.kind === "duration") formatted = `${formatted} ${unit.unit}`;
		if (unit.kind === "short")
			formatted = new Intl.NumberFormat(locale, {
				notation: "compact",
				maximumFractionDigits: config.decimals === "auto" ? 2 : config.decimals,
			}).format(value);
		if (unit.kind === "rate") formatted = `${formatted}${unit.suffix}`;
		if (unit.kind === "custom") formatted = `${formatted}${unit.suffix}`;
		return formatted;
	}
	if (typeof value === "boolean") return value ? "true" : "false";
	if (typeof value === "number" && !Number.isFinite(value))
		return config.noValueText;
	return String(value);
}
function formatBytes(
	value: number,
	base: 1000 | 1024,
	locale: string,
	decimals: "auto" | number,
) {
	const units =
		base === 1000
			? ["B", "kB", "MB", "GB", "TB"]
			: ["B", "KiB", "MiB", "GiB", "TiB"];
	let index = 0;
	let amount = Math.abs(value);
	while (amount >= base && index < units.length - 1) {
		amount /= base;
		index += 1;
	}
	const fraction = decimals === "auto" ? 2 : decimals;
	return `${new Intl.NumberFormat(locale, { maximumFractionDigits: fraction }).format(value < 0 ? -amount : amount)} ${units[index]}`;
}
export function applyValueMapping(
	value: unknown,
	config: StandardFieldConfigV2,
) {
	for (const mapping of config.valueMappings) {
		if (mapping.kind === "null" && value == null) return mapping;
		if (mapping.kind === "value" && Object.is(mapping.value, value))
			return mapping;
		if (
			mapping.kind === "range" &&
			typeof value === "number" &&
			value >= mapping.from &&
			value <= mapping.to
		)
			return mapping;
	}
	return undefined;
}
export function activeThreshold(
	value: number | null,
	config: StandardFieldConfigV2,
) {
	if (value === null || !config.thresholds) return undefined;
	return [...config.thresholds.steps]
		.filter((step) => step.value === null || step.value <= value)
		.at(-1);
}
