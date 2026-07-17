import type { DistributionColorScaleConfig } from "@shared/schemas/dashboard/distribution-visualizations.schema";

export const sequentialTokens = [
	"--color-muted",
	"--color-chart-muted",
	"--color-cyan",
	"--color-cyan",
	"--color-brand",
	"--color-brand",
	"--color-brand-strong",
	"--color-violet",
	"--color-violet",
];
export const divergingTokens = [
	"--color-cyan",
	"--color-cyan",
	"--color-brand",
	"--color-brand",
	"--color-muted",
	"--color-amber",
	"--color-rose",
	"--color-danger",
	"--color-danger",
];
export const statusTokens = [
	"--color-chart-success",
	"--color-chart-warning",
	"--color-chart-danger",
	"--color-muted-strong",
	"--color-muted",
	"--color-chart-danger",
	"--color-chart-danger",
	"--color-chart-danger",
	"--color-chart-danger",
];

export type ResolvedColorScale = {
	mode: DistributionColorScaleConfig["mode"];
	min: number;
	max: number;
	center?: number;
	centerToken?: string;
	tokens: string[];
	emptyToken: string;
};
export function resolveColorScale(
	config: DistributionColorScaleConfig,
	values: readonly (number | null)[],
) {
	const finite = values.filter(
		(value): value is number => value !== null && Number.isFinite(value),
	);
	const autoMin = finite.length ? Math.min(...finite) : 0;
	const autoMax = finite.length ? Math.max(...finite) : 1;
	const autoDomain =
		autoMin === autoMax
			? {
					min: autoMin - (Math.abs(autoMin) || 1) / 2,
					max: autoMax + (Math.abs(autoMax) || 1) / 2,
				}
			: { min: autoMin, max: autoMax };
	const domain = config.domain === "auto" ? autoDomain : config.domain;
	const min = domain.min;
	const max = domain.max === min ? min + 1 : domain.max;
	const center =
		config.mode === "diverging"
			? config.domain !== "auto" && config.domain.center !== undefined
				? config.domain.center
				: (min + max) / 2
			: config.domain !== "auto"
				? config.domain.center
				: undefined;
	const source =
		config.mode === "diverging"
			? divergingTokens
			: config.mode === "status"
				? statusTokens
				: sequentialTokens;
	const tokens = Array.from({ length: config.steps }, (_, index) => {
		const sourceIndex = Math.round(
			(index * (source.length - 1)) / Math.max(1, config.steps - 1),
		);
		return source[sourceIndex] ?? config.emptyColorToken;
	});
	return {
		mode: config.mode,
		min,
		max,
		center,
		centerToken: config.mode === "diverging" ? "--color-muted" : undefined,
		tokens,
		emptyToken: config.emptyColorToken,
	};
}
export function colorScaleToken(
	scale: ResolvedColorScale,
	value: number | null,
	state?: string,
) {
	if (value === null || !Number.isFinite(value)) return scale.emptyToken;
	if (scale.mode === "status") {
		if (state === "healthy") return "--color-chart-success";
		if (state === "warning") return "--color-chart-warning";
		if (state === "critical") return "--color-chart-danger";
		if (state === "unknown") return scale.emptyToken;
	}
	if (scale.center !== undefined && value === scale.center)
		return (
			scale.centerToken ?? scale.tokens[Math.floor(scale.tokens.length / 2)]
		);
	const denominator = scale.max - scale.min || 1;
	const ratio =
		scale.center !== undefined && value < scale.center
			? ((value - scale.min) / Math.max(1e-12, scale.center - scale.min)) * 0.5
			: scale.center !== undefined
				? 0.5 +
					((value - scale.center) / Math.max(1e-12, scale.max - scale.center)) *
						0.5
				: (value - scale.min) / denominator;
	const index = Math.max(
		0,
		Math.min(
			scale.tokens.length - 1,
			Math.round(ratio * (scale.tokens.length - 1)),
		),
	);
	return scale.tokens[index] ?? scale.emptyToken;
}
export function colorScaleLegend(scale: ResolvedColorScale) {
	const entries = scale.tokens.map((token, index) => ({
		token,
		value:
			scale.min +
			((scale.max - scale.min) * index) / Math.max(1, scale.tokens.length - 1),
	}));
	if (
		scale.center !== undefined &&
		!entries.some((entry) => entry.value === scale.center)
	)
		entries.push({
			token: scale.centerToken ?? "--color-muted",
			value: scale.center,
		});
	return entries.sort((left, right) => left.value - right.value);
}
