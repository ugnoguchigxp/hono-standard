import type { KpiRangeConfig } from "@shared/schemas/dashboard/kpi-visualizations.schema";

export type KpiRange = {
	min: number;
	max: number;
	normalized: number;
	overflow?: "below" | "above";
};

export function niceMax(value: number): number {
	if (!Number.isFinite(value) || value <= 0) return 1;
	const exponent = 10 ** Math.floor(Math.log10(value));
	const fraction = value / exponent;
	const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
	return step * exponent;
}

export function resolveKpiRange(
	_value: number,
	options: {
		min?: number | null;
		max?: number | null;
		goal?: number | null;
		values?: Array<number | null>;
		config?: KpiRangeConfig;
		unit?: { kind: string; scale?: string };
	},
): { min: number; max: number } | { error: string } {
	const config = options.config ?? {
		min: "auto",
		max: "auto",
		overflow: "show-marker",
	};
	const finite = (value: number | null | undefined): value is number =>
		typeof value === "number" && Number.isFinite(value);
	const values = (options.values ?? []).filter(finite);
	const min =
		config.min === "config" && finite(options.min)
			? options.min
			: config.min === "field" && values.length
				? Math.min(...values)
				: undefined;
	const max =
		config.max === "config" && finite(options.max)
			? options.max
			: config.max === "field" && values.length
				? Math.max(...values)
				: undefined;
	if (min !== undefined && max !== undefined) {
		if (min >= max) return { error: "min must be less than max" };
		return { min, max };
	}
	const target = Math.max(
		...values,
		finite(options.goal) ? options.goal : -Infinity,
		0,
	);
	if (target === 0) return { min: 0, max: 1 };
	const scale =
		options.unit?.kind === "percent" && options.unit.scale === "hundred"
			? 100
			: 1;
	const resolvedMin = min ?? (scale === 100 ? 0 : Math.min(0, ...values));
	const resolvedMax = max ?? niceMax(Math.max(target, scale));
	return resolvedMin < resolvedMax
		? { min: resolvedMin, max: resolvedMax }
		: { error: "min must be less than max" };
}

export function normalizeKpiValue(
	value: number | null | undefined,
	range: { min: number; max: number },
	overflow: KpiRangeConfig["overflow"] = "show-marker",
): KpiRange | { error: string } {
	if (typeof value !== "number" || !Number.isFinite(value))
		return { error: "value must be finite" };
	const normalized = (value - range.min) / (range.max - range.min);
	const overflowState =
		value < range.min ? "below" : value > range.max ? "above" : undefined;
	if (overflowState && overflow === "reject")
		return { error: "value is outside range" };
	return {
		min: range.min,
		max: range.max,
		normalized,
		...(overflowState ? { overflow: overflowState } : {}),
	};
}

export function clampGeometry(value: number) {
	return Math.min(1, Math.max(0, value));
}
