export type HistogramBin = {
	start: number;
	end: number;
	count: number;
	series?: string;
};

export type BinningRule =
	| { mode: "fixed-count"; count: number }
	| { mode: "fixed-width"; width: number; origin?: number }
	| { mode: "sturges" }
	| { mode: "freedman-diaconis"; fallbackCount: number };

const finite = (values: readonly number[]) => values.filter(Number.isFinite);
export const quantileR7 = (values: readonly number[], probability: number) => {
	const sorted = [...finite(values)].sort((a, b) => a - b);
	if (!sorted.length) return null;
	if (sorted.length === 1) return sorted[0] ?? null;
	const position = (sorted.length - 1) * probability;
	const lower = Math.floor(position);
	const upper = Math.ceil(position);
	const lowerValue = sorted[lower];
	const upperValue = sorted[upper];
	if (lowerValue === undefined || upperValue === undefined) return null;
	const fraction = position - lower;
	return lowerValue * (1 - fraction) + upperValue * fraction;
};

export function chooseBinCount(values: readonly number[], rule: BinningRule) {
	const usable = finite(values);
	if (rule.mode === "fixed-count") return rule.count;
	if (rule.mode === "freedman-diaconis") {
		const q1 = quantileR7(usable, 0.25) ?? 0;
		const q3 = quantileR7(usable, 0.75) ?? 0;
		const width = (2 * (q3 - q1)) / Math.cbrt(Math.max(1, usable.length));
		if (!(width > 0) || !Number.isFinite(width)) return rule.fallbackCount;
		const range = (Math.max(...usable) ?? 0) - (Math.min(...usable) ?? 0);
		return Math.max(2, Math.min(100, Math.ceil(range / width)));
	}
	if (rule.mode === "sturges")
		return Math.max(
			2,
			Math.min(100, Math.ceil(Math.log2(Math.max(1, usable.length)) + 1)),
		);
	return Math.max(
		2,
		Math.min(
			100,
			Math.ceil((Math.max(...usable) - Math.min(...usable)) / rule.width),
		),
	);
}

export function binValues(
	values: readonly number[],
	rule: BinningRule,
	range?: { min: number; max: number },
) {
	const usable = finite(values);
	if (!usable.length) return [] as HistogramBin[];
	const dataMin = Math.min(...usable);
	const dataMax = Math.max(...usable);
	const min = range?.min ?? dataMin;
	const max = range?.max ?? dataMax;
	if (!Number.isFinite(min) || !Number.isFinite(max) || min > max)
		throw new Error("INVALID_HISTOGRAM_RANGE");
	if (min === max) {
		const width = Math.max(Math.abs(min) * 0.1, 0.5);
		return [{ start: min - width, end: min + width, count: usable.length }];
	}
	let width: number;
	let start: number;
	let count: number;
	if (rule.mode === "fixed-width") {
		width = rule.width;
		const origin = rule.origin ?? 0;
		start = origin + Math.floor((min - origin) / width) * width;
		count = Math.ceil((max - start) / width);
	} else {
		count = chooseBinCount(usable, rule);
		width = (max - min) / count;
		start = min;
	}
	if (!(width > 0) || !Number.isFinite(width) || count < 1 || count > 100)
		throw new Error("INVALID_HISTOGRAM_BINS");
	const bins = Array.from({ length: count }, (_, index) => ({
		start: start + index * width,
		end: start + (index + 1) * width,
		count: 0,
	}));
	for (const value of usable) {
		// An explicit domain is a hard inclusion boundary even when a fixed-width
		// origin places the first/last display bin outside that domain.
		if (value < min || value > max) continue;
		const index =
			value === max ? bins.length - 1 : Math.floor((value - start) / width);
		if (index < 0 || index >= bins.length) continue;
		const target = bins[index];
		if (!target) continue;
		// The final interval is closed on the right; other intervals are [start, end).
		if (
			value < target.end ||
			(index === bins.length - 1 && value <= target.end)
		)
			target.count += 1;
	}
	return bins;
}

export function normalizeHistogramBins(bins: readonly HistogramBin[]) {
	const ordered = [...bins].sort((a, b) => a.start - b.start);
	for (let index = 1; index < ordered.length; index += 1) {
		const previous = ordered[index - 1];
		const current = ordered[index];
		if (!previous || !current) continue;
		if (current.start < previous.end) throw new Error("HISTOGRAM_BINS_OVERLAP");
	}
	return ordered;
}
