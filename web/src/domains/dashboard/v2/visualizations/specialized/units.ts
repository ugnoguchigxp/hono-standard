import {
	resolveEffectiveFieldConfig,
	type DashboardDataFrameV2,
	type FieldUnitV2,
	type VisualizationSpecV2,
} from "@shared/schemas/dashboard.schema";

type DashboardField = DashboardDataFrameV2["fields"][number];

export function resolveSpecializedFieldConfig(
	spec: VisualizationSpecV2,
	frame: DashboardDataFrameV2,
	field: DashboardField,
) {
	return resolveEffectiveFieldConfig(
		spec.fieldConfig,
		field.config,
		spec.overrides,
		{
			frameRefId: frame.refId,
			source: frame.source,
			fieldKey: field.key,
			fieldType: field.type,
			fieldRoles: field.roles,
		},
	);
}

function unitKey(unit: FieldUnitV2) {
	switch (unit.kind) {
		case "percent":
			return `${unit.kind}:${unit.scale}`;
		case "bytes":
			return `${unit.kind}:${unit.base}`;
		case "duration":
			return `${unit.kind}:${unit.unit}`;
		case "rate":
		case "custom":
			return `${unit.kind}:${unit.suffix}`;
		case "currency":
			return `${unit.kind}:${unit.code}`;
		default:
			return unit.kind;
	}
}

export function validateOhlcUnits(
	frame: DashboardDataFrameV2,
	spec: VisualizationSpecV2,
) {
	const priceFields = frame.fields.filter((field) =>
		field.roles.some((role) =>
			["open", "high", "low", "close", "baseline"].includes(role),
		),
	);
	const units = new Set(
		priceFields.map((field) =>
			unitKey(resolveSpecializedFieldConfig(spec, frame, field).unit),
		),
	);
	return units.size > 1
		? "OHLC price fields require identical units"
		: undefined;
}

export function resolveTraceDurationMultiplier(
	frame: DashboardDataFrameV2,
	spec: VisualizationSpecV2,
) {
	const field = frame.fields.find((candidate) =>
		candidate.roles.includes("duration"),
	);
	if (!field) return { error: "Trace duration field is missing" } as const;
	const unit = resolveSpecializedFieldConfig(spec, frame, field).unit;
	if (unit.kind !== "duration")
		return {
			error: "Trace duration requires an explicit duration unit",
		} as const;
	const multipliers = { ns: 1e-6, us: 1e-3, ms: 1, s: 1_000 } as const;
	if (!(unit.unit in multipliers))
		return { error: "Trace duration supports ns, us, ms, or s" } as const;
	return {
		multiplier: multipliers[unit.unit as keyof typeof multipliers],
	} as const;
}
