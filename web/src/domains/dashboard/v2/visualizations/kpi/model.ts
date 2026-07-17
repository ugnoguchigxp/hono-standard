import type {
	DashboardDataFrameV2,
	DashboardFieldV2,
} from "@shared/schemas/dashboard/data-frame.schema";
import {
	type StandardFieldConfigV2,
	standardFieldConfigV2Schema,
} from "@shared/schemas/dashboard/field-config.schema";
import type {
	DeltaConfig,
	KpiRangeConfig,
	KpiValueBinding,
} from "@shared/schemas/dashboard/kpi-visualizations.schema";
import { formatDashboardValue } from "../../runtime/value-format";
import { resolveKpiRange } from "./range";
import { type KpiState, resolveDeltaSentiment, resolveKpiState } from "./state";

export type KpiDatum = {
	id: string;
	label: string;
	current: number | string | boolean | null;
	numericCurrent?: number;
	previous?: number | null;
	delta?: number;
	deltaPercent?: number | null;
	goal?: number | null;
	min?: number;
	max?: number;
	normalized?: number;
	overflow?: "below" | "above";
	state: KpiState;
	sentiment: ReturnType<typeof resolveDeltaSentiment>;
	formatted: Record<
		"current" | "previous" | "delta" | "goal" | "min" | "max",
		string | undefined
	>;
	sparkline?: Array<{ time: number; value: number | null }>;
};

export type KpiModel = {
	items: KpiDatum[];
	error?: string;
	range?: { min: number; max: number };
};
type NumericField = Extract<DashboardFieldV2, { type: "number" }>;

export function countKpiItems(frame: DashboardDataFrameV2 | undefined): number {
	if (!frame) return 0;
	const category = frame.fields.find((field) =>
		field.roles.includes("category"),
	);
	if (category) return category.values.length;
	const values = frame.fields.filter((field) => field.roles.includes("value"));
	return Math.max(1, values.length);
}

function numeric(
	field: DashboardFieldV2 | undefined,
): NumericField | undefined {
	return field?.type === "number" ? field : undefined;
}

export function resolveKpiField(
	frame: DashboardDataFrameV2,
	binding: KpiValueBinding | undefined,
	role: "value" | "previous" | "delta" | "goal",
): DashboardFieldV2 | undefined {
	const configured = binding?.[`${role}FieldKey` as keyof KpiValueBinding] as
		| string
		| undefined;
	if (configured) return frame.fields.find((field) => field.key === configured);
	const roleField = frame.fields.filter((field) => field.roles.includes(role));
	if (roleField.length === 1) return roleField[0];
	if (roleField.length > 1) return undefined;
	if (role !== "value") {
		const fallback = frame.fields.find((field) => field.key === role);
		return fallback;
	}
	const values = frame.fields.filter(
		(field) =>
			field.type === "number" &&
			!field.roles.some((item) => ["previous", "delta", "goal"].includes(item)),
	);
	return values.length === 1 ? values[0] : undefined;
}

function usableValue(value: unknown): boolean {
	return (
		value !== null &&
		value !== undefined &&
		(typeof value !== "number" || Number.isFinite(value))
	);
}

function selectedIndex(
	field: DashboardFieldV2,
	reduce: "last" | "last-not-null",
) {
	if (!field.values.length) return 0;
	if (reduce === "last") return field.values.length - 1;
	for (let index = field.values.length - 1; index >= 0; index -= 1)
		if (usableValue(field.values[index])) return index;
	return field.values.length - 1;
}

function hasAmbiguousRole(
	frame: DashboardDataFrameV2,
	binding: KpiValueBinding | undefined,
	role: "value" | "previous" | "delta" | "goal",
) {
	const configured = binding?.[`${role}FieldKey` as keyof KpiValueBinding];
	return (
		!configured &&
		frame.fields.filter((field) => field.roles.includes(role)).length > 1
	);
}

export function buildKpiModel(
	frames: DashboardDataFrameV2[],
	options: {
		binding?: KpiValueBinding;
		delta?: DeltaConfig;
		range?: KpiRangeConfig;
		reduce?: "last" | "last-not-null";
		maxItems?: number;
		maxPoints?: number;
		fieldConfig?: StandardFieldConfigV2;
		locale?: string;
		timezone?: string;
	},
): KpiModel {
	const frame = frames[0];
	if (!frame) return { items: [], error: "KPI data frame is missing" };
	for (const role of ["value", "previous", "delta", "goal"] as const)
		if (hasAmbiguousRole(frame, options.binding, role))
			return { items: [], error: `${role} field is ambiguous` };
	const valueField = resolveKpiField(frame, options.binding, "value");
	if (!valueField)
		return { items: [], error: "KPI value field is ambiguous or missing" };
	const previousField = numeric(
		resolveKpiField(frame, options.binding, "previous"),
	);
	const deltaField = numeric(resolveKpiField(frame, options.binding, "delta"));
	const goalField = numeric(resolveKpiField(frame, options.binding, "goal"));
	const index = selectedIndex(valueField, options.reduce ?? "last-not-null");
	const current = valueField.values[index] as KpiDatum["current"];
	const numericCurrent =
		typeof current === "number" && Number.isFinite(current)
			? current
			: undefined;
	let previous = previousField
		? (previousField.values[
				selectedIndex(previousField, options.reduce ?? "last-not-null")
			] as number | null)
		: undefined;
	if (previous === undefined && valueField.type === "number" && index > 0) {
		for (
			let previousIndex = index - 1;
			previousIndex >= 0;
			previousIndex -= 1
		) {
			const candidate = valueField.values[previousIndex];
			if (typeof candidate === "number" && Number.isFinite(candidate)) {
				previous = candidate;
				break;
			}
		}
	}
	const explicitDelta = deltaField
		? (deltaField.values[
				selectedIndex(deltaField, options.reduce ?? "last-not-null")
			] as number | null)
		: undefined;
	const delta =
		typeof explicitDelta === "number" && Number.isFinite(explicitDelta)
			? explicitDelta
			: numericCurrent !== undefined && typeof previous === "number"
				? numericCurrent - previous
				: undefined;
	const goal = goalField
		? (goalField.values[
				selectedIndex(goalField, options.reduce ?? "last-not-null")
			] as number | null)
		: undefined;
	const rangeResult =
		numericCurrent !== undefined
			? resolveKpiRange(numericCurrent, {
					min: options.fieldConfig?.min,
					max: options.fieldConfig?.max,
					values: valueField.type === "number" ? valueField.values : [],
					goal,
					config: options.range,
					unit: options.fieldConfig?.unit,
				})
			: undefined;
	if (rangeResult && "error" in rangeResult)
		return { items: [], error: rangeResult.error };
	const range = rangeResult && "min" in rangeResult ? rangeResult : undefined;
	if (
		range &&
		typeof goal === "number" &&
		(goal < range.min || goal > range.max) &&
		options.range?.overflow === "reject"
	)
		return { items: [], error: "goal is outside range" };
	const normalized =
		numericCurrent !== undefined && range
			? (numericCurrent - range.min) / (range.max - range.min)
			: undefined;
	const overflow =
		numericCurrent !== undefined && range
			? numericCurrent < range.min
				? "below"
				: numericCurrent > range.max
					? "above"
					: undefined
			: undefined;
	if (overflow && options.range?.overflow === "reject")
		return { items: [], error: "value is outside range" };
	const formatter = (value: unknown) =>
		value === undefined
			? undefined
			: formatDashboardValue(
					value as never,
					options.fieldConfig ?? standardFieldConfigV2Schema.parse({}),
					options.locale ?? "en-US",
					options.timezone ?? "UTC",
					valueField.type,
				);
	const deltaPercent =
		typeof delta === "number" && typeof previous === "number" && previous !== 0
			? (delta / Math.abs(previous)) * 100
			: null;
	const deltaFormatter = () => {
		if (delta === undefined) return undefined;
		if (options.delta?.mode === "percent")
			return deltaPercent === null
				? undefined
				: `${new Intl.NumberFormat(options.locale ?? "en-US", {
						maximumFractionDigits:
							options.fieldConfig?.decimals === "auto"
								? 2
								: options.fieldConfig?.decimals,
					}).format(deltaPercent)}%`;
		if (options.delta?.mode === "percent-points") {
			if (options.fieldConfig?.unit.kind !== "percent") return undefined;
			const points =
				options.fieldConfig.unit.scale === "unit" ? delta * 100 : delta;
			return `${new Intl.NumberFormat(options.locale ?? "en-US", {
				maximumFractionDigits:
					options.fieldConfig.decimals === "auto"
						? 2
						: options.fieldConfig.decimals,
			}).format(points)} pp`;
		}
		return formatter(delta);
	};
	const item: KpiDatum = {
		id: `${frame.refId}:${valueField.key}`,
		label: valueField.label,
		current,
		...(numericCurrent === undefined ? {} : { numericCurrent }),
		...(typeof previous === "number" ? { previous } : {}),
		...(typeof delta === "number"
			? {
					delta,
					deltaPercent,
				}
			: {}),
		...(typeof goal === "number" ? { goal } : {}),
		...(range ? { min: range.min, max: range.max } : {}),
		...(normalized === undefined
			? {}
			: { normalized, ...(overflow ? { overflow } : {}) }),
		state: resolveKpiState(current, options.fieldConfig),
		sentiment: resolveDeltaSentiment(
			delta,
			options.delta ?? {
				mode: "absolute",
				sentiment: "neutral",
				zeroTolerance: 0,
			},
		),
		formatted: {
			current: formatter(current),
			previous: formatter(previous),
			delta: deltaFormatter(),
			goal: formatter(goal),
			min: formatter(range?.min),
			max: formatter(range?.max),
		},
	};
	if (valueField.type === "number" && valueField.values.length > 1) {
		const timeField = frame.fields.find((field) =>
			field.roles.includes("time"),
		);
		const start = Math.max(
			0,
			valueField.values.length - Math.min(options.maxPoints ?? 100, 100),
		);
		item.sparkline = valueField.values
			.slice(start)
			.map((value, pointIndex) => ({
				time: Number(
					timeField?.values[start + pointIndex] ?? start + pointIndex,
				),
				value,
			}));
	}
	return { items: [item], range };
}

export function buildKpiListModel(
	frames: DashboardDataFrameV2[],
	options: Parameters<typeof buildKpiModel>[1] & { maxItems?: number },
): KpiModel {
	const frame = frames[0];
	if (!frame) return { items: [], error: "KPI data frame is missing" };
	const category = frame.fields.find((field) =>
		field.roles.includes("category"),
	);
	const values = frame.fields.filter(
		(field) => field.type === "number" && field.roles.includes("value"),
	);
	if (category && values.length) {
		const items = values
			.flatMap((field) =>
				category.values.flatMap((label, index) =>
					buildKpiModel(
						[
							{
								...frame,
								fields: frame.fields.map((candidate) =>
									candidate.key === field.key
										? { ...candidate, values: [candidate.values[index]] }
										: candidate.key === category.key
											? { ...candidate, values: [candidate.values[index]] }
											: {
													...candidate,
													values: [candidate.values[index] ?? null],
												},
								) as DashboardDataFrameV2["fields"],
							},
						],
						{
							...options,
							binding: {
								...options.binding,
								valueFieldKey: field.key,
								previousFieldKey: frame.fields.find((candidate) =>
									candidate.roles.includes("previous"),
								)?.key,
								goalFieldKey: frame.fields.find((candidate) =>
									candidate.roles.includes("goal"),
								)?.key,
							},
						},
					).items.map((item) => ({
						...item,
						id: `${frame.refId}:${field.key}:${String(label)}`,
						label: String(label),
					})),
				),
			)
			.slice(0, options.maxItems ?? 12);
		return { items };
	}
	return buildKpiModel(frames, options);
}
