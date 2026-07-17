import type {
	DashboardFieldV2,
	StandardFieldConfigV2,
	ValueMappingV2,
} from "@shared/schemas/dashboard.schema";

export type StateSemantic = "healthy" | "warning" | "critical" | "unknown";
export type StateDatum = {
	raw: string | number | boolean | null;
	text: string;
	semantic: StateSemantic;
	colorToken: string;
};

const defaultTokens: Record<StateSemantic, string> = {
	healthy: "--color-chart-success",
	warning: "--color-chart-warning",
	critical: "--color-chart-danger",
	unknown: "--color-chart-muted",
};
const aliases: Record<string, StateSemantic> = {
	healthy: "healthy",
	ok: "healthy",
	up: "healthy",
	success: "healthy",
	operational: "healthy",
	warning: "warning",
	degraded: "warning",
	warn: "warning",
	critical: "critical",
	down: "critical",
	error: "critical",
	failed: "critical",
	outage: "critical",
	unknown: "unknown",
	offline: "unknown",
	"no-data": "unknown",
	missing: "unknown",
};

export function stateRawIdentity(value: StateDatum["raw"]) {
	return value === null ? "null:" : `${typeof value}:${String(value)}`;
}

function mappingFor(raw: StateDatum["raw"], mappings: ValueMappingV2[]) {
	for (const mapping of mappings) {
		if (mapping.kind === "null" && raw === null) return mapping;
		if (mapping.kind === "value" && Object.is(mapping.value, raw))
			return mapping;
		if (
			mapping.kind === "range" &&
			typeof raw === "number" &&
			raw >= mapping.from &&
			raw <= mapping.to
		)
			return mapping;
	}
	return undefined;
}

function semanticFor(text: string, raw: StateDatum["raw"]): StateSemantic {
	const alias = aliases[text.trim().toLowerCase()];
	if (alias) return alias;
	if (typeof raw === "number") return "unknown";
	return "unknown";
}

export function resolveStateDatum(
	raw: StateDatum["raw"],
	config:
		| Pick<
				StandardFieldConfigV2,
				"valueMappings" | "thresholds" | "min" | "max" | "color"
		  >
		| undefined = undefined,
): StateDatum {
	const mapping = mappingFor(raw, config?.valueMappings ?? []);
	if (mapping) {
		const text = mapping.text;
		return {
			raw,
			text,
			semantic: semanticFor(text, raw),
			colorToken: mapping.colorToken ?? defaultTokens[semanticFor(text, raw)],
		};
	}
	if (raw === null)
		return {
			raw,
			text: "Unknown",
			semantic: "unknown",
			colorToken: defaultTokens.unknown,
		};
	if (typeof raw === "number" && config?.thresholds) {
		const steps = config.thresholds.steps;
		const thresholdValue =
			config.thresholds.mode === "percentage" &&
			config.min !== undefined &&
			config.max !== undefined
				? ((raw - config.min) / (config.max - config.min)) * 100
				: raw;
		let chosen = steps[0];
		for (const step of steps)
			if (step.value !== null && thresholdValue >= step.value) chosen = step;
		const semantic = semanticFor(chosen?.label ?? "", raw);
		return {
			raw,
			text: chosen?.label ?? String(raw),
			semantic,
			colorToken: chosen?.colorToken ?? defaultTokens[semantic],
		};
	}
	const text = String(raw);
	const semantic = semanticFor(text, raw);
	return {
		raw,
		text,
		semantic,
		colorToken:
			config?.color?.mode === "fixed"
				? config.color.token
				: defaultTokens[semantic],
	};
}

export function resolveStateField(
	field: DashboardFieldV2,
	row: number,
): StateDatum {
	const raw = field.values[row] as StateDatum["raw"];
	return resolveStateDatum(
		raw,
		field.config as StandardFieldConfigV2 | undefined,
	);
}

export const stateColorToken = (semantic: StateSemantic) =>
	defaultTokens[semantic];
