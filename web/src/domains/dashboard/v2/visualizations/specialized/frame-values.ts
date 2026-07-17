import type {
	DashboardDataFrameV2,
	DashboardFieldV2,
	DashboardFieldRole,
} from "@shared/schemas/dashboard.schema";

export function fieldFor(
	frame: DashboardDataFrameV2,
	role: DashboardFieldRole,
	key?: string,
) {
	return frame.fields.find(
		(field) => field.roles.includes(role) && (!key || field.key === key),
	);
}

export function valueAt(
	field: DashboardFieldV2 | undefined,
	index: number,
): unknown {
	return field?.values[index];
}

export function stringAt(
	field: DashboardFieldV2 | undefined,
	index: number,
	fallback = "",
) {
	const value = valueAt(field, index);
	return typeof value === "string"
		? value
		: value == null
			? fallback
			: String(value);
}

export function numberAt(field: DashboardFieldV2 | undefined, index: number) {
	const value = valueAt(field, index);
	return typeof value === "number" && Number.isFinite(value)
		? value
		: undefined;
}

export function rowCount(frame: DashboardDataFrameV2) {
	return frame.fields[0]?.values.length ?? 0;
}
