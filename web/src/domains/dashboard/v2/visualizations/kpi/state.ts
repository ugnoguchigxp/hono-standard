import type { StandardFieldConfigV2 } from "@shared/schemas/dashboard/field-config.schema";
import type { DeltaConfig } from "@shared/schemas/dashboard/kpi-visualizations.schema";

export type KpiState = "healthy" | "warning" | "critical" | "unknown";
export type DeltaSentiment =
	| "improved"
	| "worsened"
	| "unchanged"
	| "neutral"
	| "unknown";

export function resolveKpiState(
	value: number | string | boolean | null | undefined,
	config?: Pick<StandardFieldConfigV2, "thresholds" | "valueMappings">,
): KpiState {
	if (value === null || value === undefined) return "unknown";
	const mapping = config?.valueMappings?.find((item) =>
		item.kind === "value"
			? item.value === value
			: item.kind === "range" && typeof value === "number"
				? value >= item.from && value <= item.to
				: item.kind === "null" && value === null,
	);
	if (mapping?.text) return stateFromText(mapping.text);
	if (typeof value === "number" && config?.thresholds?.mode === "absolute") {
		let state: KpiState = "healthy";
		for (const step of config.thresholds.steps) {
			if (step.value !== null && value >= step.value)
				state = stateFromText(step.label ?? "");
		}
		return state;
	}
	return "unknown";
}

function stateFromText(text: string): KpiState {
	const lower = text.toLowerCase();
	if (/(critical|danger|error|fail|bad)/.test(lower)) return "critical";
	if (/(warning|warn|degrad)/.test(lower)) return "warning";
	if (/(healthy|ok|good|success|normal)/.test(lower)) return "healthy";
	return "unknown";
}

export function resolveDeltaSentiment(
	delta: number | null | undefined,
	config: DeltaConfig,
): DeltaSentiment {
	if (delta === null || delta === undefined || !Number.isFinite(delta))
		return "unknown";
	if (Math.abs(delta) <= config.zeroTolerance) return "unchanged";
	if (config.sentiment === "neutral") return "neutral";
	const improved =
		config.sentiment === "higher-is-better" ? delta > 0 : delta < 0;
	return improved ? "improved" : "worsened";
}

export function stateToken(state: KpiState): string {
	return {
		healthy: "--color-chart-success",
		warning: "--color-chart-warning",
		critical: "--color-chart-danger",
		unknown: "--color-muted",
	}[state];
}
