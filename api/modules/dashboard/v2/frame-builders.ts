import {
	dashboardDataFrameV2Schema,
	dashboardFieldV2Schema,
	panelDataStateV2Schema,
	type DashboardDataFrameV2,
	type DashboardFieldRole,
	type DashboardFieldV2,
	type DashboardFieldType,
	type PanelDataStateV2,
} from "../../../../shared/schemas/dashboard.schema";
import type {
	DashboardQueryFrameInputV2,
	DashboardQueryHandlerResultV2,
} from "./types";

type FieldOptions = Partial<
	Pick<DashboardFieldV2, "label" | "roles" | "labels" | "config">
>;
function field<T extends DashboardFieldType>(
	type: T,
	key: string,
	values: DashboardFieldV2["values"],
	options: FieldOptions = {},
): DashboardFieldV2 {
	const value = dashboardFieldV2Schema.parse({
		key,
		label: options.label ?? key,
		type,
		values,
		roles: options.roles ?? [],
		labels: options.labels ?? {},
		...(options.config ? { config: options.config } : {}),
	});
	return structuredClone(value);
}

export const timeField = (
	key: string,
	values: Array<number | null>,
	options: FieldOptions = {},
) =>
	field("time", key, [...values], {
		roles: options.roles ?? (["time"] as DashboardFieldRole[]),
		...options,
	});
export const numberField = (
	key: string,
	values: Array<number | null>,
	options: FieldOptions = {},
) => field("number", key, [...values], options);
export const stringField = (
	key: string,
	values: Array<string | null>,
	options: FieldOptions = {},
) => field("string", key, [...values], options);
export const booleanField = (
	key: string,
	values: Array<boolean | null>,
	options: FieldOptions = {},
) => field("boolean", key, [...values], options);

export function dataFrame(input: {
	refId: string;
	name: string;
	shapeHint?: DashboardDataFrameV2["meta"]["shapeHint"];
	fields: DashboardDataFrameV2["fields"];
	meta?: DashboardDataFrameV2["meta"];
}): DashboardQueryFrameInputV2 {
	const frame = dashboardDataFrameV2Schema.parse({
		schemaVersion: 2,
		source: { kind: "query", refId: input.refId },
		refId: input.refId,
		name: input.name,
		fields: input.fields,
		meta: {
			...(input.meta ?? {}),
			...(input.shapeHint ? { shapeHint: input.shapeHint } : {}),
		},
	});
	const { schemaVersion: _schemaVersion, source: _source, ...result } = frame;
	return structuredClone(result);
}

export function queryResult(input: {
	frames: DashboardQueryFrameInputV2[];
	state?: PanelDataStateV2 | unknown;
}): DashboardQueryHandlerResultV2 {
	const frames = input.frames.map((frame) => {
		const value = { ...frame } as Record<string, unknown>;
		if ("schemaVersion" in value || "source" in value)
			throw new Error("query frame must not include schemaVersion or source");
		return structuredClone(frame);
	});
	return {
		frames,
		state:
			input.state === undefined
				? undefined
				: panelDataStateV2Schema.parse(input.state),
	};
}
