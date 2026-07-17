import { clamp } from "./limits";

export type NumericScale = {
	min: number;
	max: number;
	valueToRatio: (value: number) => number;
	ratioToValue: (ratio: number) => number;
};

export function createNumericScale(
	values: readonly number[],
	includeZero = false,
	domain?: { min: number; max: number },
): NumericScale {
	if (
		domain &&
		(!Number.isFinite(domain.min) ||
			!Number.isFinite(domain.max) ||
			domain.min >= domain.max)
	)
		throw new Error("numeric scale domain is invalid");
	const finiteValues = values.filter(Number.isFinite);
	let min =
		domain?.min ?? (finiteValues.length ? Math.min(...finiteValues) : 0);
	let max =
		domain?.max ?? (finiteValues.length ? Math.max(...finiteValues) : 1);
	if (domain) {
		const outside = finiteValues.some(
			(value) => value < domain.min || value > domain.max,
		);
		if (outside) throw new Error("configured domain excludes OHLC values");
	}
	if (includeZero && !domain) {
		min = Math.min(0, min);
		max = Math.max(0, max);
	}
	if (min === max) {
		const padding = Math.max(1, Math.abs(min) * 0.05);
		min -= padding;
		max += padding;
	} else if (!includeZero && !domain) {
		const padding = (max - min) * 0.05;
		min -= padding;
		max += padding;
	}
	const span = max - min;
	if (!Number.isFinite(span) || span <= 0)
		throw new Error("numeric scale range is invalid");
	return {
		min,
		max,
		valueToRatio: (value) => clamp((value - min) / span, 0, 1),
		ratioToValue: (ratio) => min + clamp(ratio, 0, 1) * span,
	};
}
