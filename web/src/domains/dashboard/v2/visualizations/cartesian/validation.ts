import {
	resolveEffectiveFieldConfig,
	type DashboardDataFrameV2,
	type FieldUnitV2,
	type VisualizationSpecV2,
} from "@shared/schemas/dashboard.schema";

type DashboardField = DashboardDataFrameV2["fields"][number];
export type CartesianAxisFields = {
	label: string;
	fields: Array<{ frame: DashboardDataFrameV2; field: DashboardField }>;
};

function unitFamily(unit: FieldUnitV2) {
	switch (unit.kind) {
		case "none":
		case "short":
			return "number";
		case "currency":
			return `currency:${unit.code}`;
		case "rate":
		case "custom":
			return `${unit.kind}:${unit.suffix}`;
		default:
			return unit.kind;
	}
}

export function validateCartesianUnitAxes(
	spec: VisualizationSpecV2,
	axes: CartesianAxisFields[],
) {
	for (const axis of axes) {
		const families = new Set(
			axis.fields.map(({ frame, field }) =>
				unitFamily(
					resolveEffectiveFieldConfig(
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
					).unit,
				),
			),
		);
		if (families.size > 1)
			return `Cartesian ${axis.label} axis requires consistent units`;
	}
	return undefined;
}

export function validateCartesianDomains(
	frames: DashboardDataFrameV2[],
	role: "time" | "category",
) {
	for (const frame of frames) {
		const fields = frame.fields.filter((candidate) =>
			candidate.roles.includes(role),
		);
		if (fields.length !== 1)
			return `Cartesian ${role} domain must contain exactly one field per frame`;
		const field = fields[0];
		if (!field) return `Cartesian ${role} domain is missing`;
		const seen = new Set<string>();
		for (const value of field.values) {
			if (role === "time") {
				const time = Number(value);
				if (value === null || !Number.isFinite(time))
					return "Cartesian time domain must contain finite timestamps";
			}
			const key = value === null ? "—" : String(value);
			if (seen.has(key)) return `Cartesian ${role} domain must be unique`;
			seen.add(key);
		}
	}
	return undefined;
}
