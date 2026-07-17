import {
	DASHBOARD_V2_LIMITS,
	type DashboardDataShape,
	type DashboardFieldRole,
	type DashboardFieldType,
	dashboardDataFrameV2Schema,
	dashboardDataShapeSchema,
	dashboardFieldV2Schema,
	type PanelDataStateV2,
	panelDataStateV2Schema,
	type StandardFieldConfigPatchV2,
	validateDashboardDataFrameShape,
} from "../../../../../shared/schemas/dashboard.schema";
import { dataFrame } from "../frame-builders";
import type { DashboardQueryFrameInputV2 } from "../types";

type SourceRecordColumn<TRow extends object> = {
	source: Extract<keyof TRow, string>;
	accessor?: never;
	key?: string;
};

type AccessorRecordColumn<TRow extends object> = {
	source?: never;
	accessor: (row: TRow, index: number) => unknown;
	key: string;
};

export type DashboardRecordColumn<TRow extends object> = (
	| SourceRecordColumn<TRow>
	| AccessorRecordColumn<TRow>
) & {
	label?: string;
	type: DashboardFieldType;
	roles?: readonly DashboardFieldRole[];
	labels?: Readonly<Record<string, string>>;
	config?: StandardFieldConfigPatchV2;
};

export type DashboardRecordOverflowPolicy = "error" | "truncate";

export class DashboardRecordAdapterError extends Error {
	readonly name = "DashboardRecordAdapterError";

	constructor(readonly cause?: unknown) {
		super("Dashboard records could not be converted to a data frame");
	}
}

export type RecordsToDataFrameResultV2 = {
	frame: DashboardQueryFrameInputV2;
	state?: PanelDataStateV2;
};

export function recordsToDataFrameV2<TRow extends object>(input: {
	records: readonly TRow[];
	refId: string;
	name: string;
	outputShape?: DashboardDataShape;
	columns: readonly DashboardRecordColumn<TRow>[];
	maxRows?: number;
	overflow?: DashboardRecordOverflowPolicy;
}): RecordsToDataFrameResultV2 {
	try {
		const outputShape = dashboardDataShapeSchema.parse(
			input.outputShape ?? "table",
		);
		if (
			input.maxRows !== undefined &&
			(!Number.isSafeInteger(input.maxRows) || input.maxRows < 1)
		)
			throw new TypeError("maxRows must be a positive safe integer");
		if (
			input.columns.length < 1 ||
			input.columns.length > DASHBOARD_V2_LIMITS.maxFieldsPerFrame
		)
			throw new TypeError("columns exceed dashboard field limits");

		const resolvedColumns = input.columns.map((column) => {
			const hasSource = column.source !== undefined;
			const hasAccessor = typeof column.accessor === "function";
			if (hasSource === hasAccessor)
				throw new TypeError("column requires exactly one source or accessor");
			const key = column.key ?? String(column.source);
			return {
				...column,
				key,
				label: column.label ?? key,
				roles: [...(column.roles ?? [])],
				labels: { ...(column.labels ?? {}) },
				config:
					column.config === undefined
						? undefined
						: structuredClone(column.config),
			};
		});
		if (
			new Set(resolvedColumns.map((column) => column.key)).size !==
			resolvedColumns.length
		)
			throw new TypeError("column keys must be unique");

		const cellRowLimit = Math.floor(
			DASHBOARD_V2_LIMITS.maxCellsPerFrame / resolvedColumns.length,
		);
		const effectiveMaxRows = Math.min(
			input.maxRows ?? DASHBOARD_V2_LIMITS.maxRowsPerFrame,
			DASHBOARD_V2_LIMITS.maxRowsPerFrame,
			cellRowLimit,
		);
		const truncated = input.records.length > effectiveMaxRows;
		if (truncated && (input.overflow ?? "error") === "error")
			throw new RangeError("records exceed the dashboard row limit");
		const records = input.records.slice(0, effectiveMaxRows);
		for (const row of records) assertPlainRecord(row);

		const fields = resolvedColumns.map((column) => {
			const values = records.map((row, index) => {
				let raw: unknown;
				if (column.accessor) raw = column.accessor(row, index);
				else {
					const source = column.source as string;
					if (!Object.hasOwn(row, source))
						throw new TypeError(
							"record is missing a configured source property",
						);
					raw = (row as Record<string, unknown>)[source];
				}
				return convertCell(raw, column.type);
			});
			return dashboardFieldV2Schema.parse({
				key: column.key,
				label: column.label,
				type: column.type,
				values,
				roles: column.roles,
				labels: column.labels,
				...(column.config === undefined ? {} : { config: column.config }),
			});
		});

		const frame = dataFrame({
			refId: input.refId,
			name: input.name,
			shapeHint: outputShape,
			fields,
		});
		const parsedFrame = dashboardDataFrameV2Schema.parse({
			...frame,
			schemaVersion: 2,
			source: { kind: "query", refId: input.refId },
		});
		const shape = validateDashboardDataFrameShape(
			records.length === 0 ? createShapeProbeFrame(parsedFrame) : parsedFrame,
		);
		if (!shape.valid)
			throw new TypeError("record columns do not satisfy output shape");

		return {
			frame,
			...(truncated
				? {
						state: panelDataStateV2Schema.parse({
							truncated: true,
							notices: [
								{
									severity: "warning",
									code: "DATA_TRUNCATED",
									message: "Data was truncated",
									frameRefId: input.refId,
								},
							],
						}),
					}
				: {}),
		};
	} catch (error) {
		if (error instanceof DashboardRecordAdapterError) throw error;
		throw new DashboardRecordAdapterError(error);
	}
}

function createShapeProbeFrame(
	frame: ReturnType<typeof dashboardDataFrameV2Schema.parse>,
): ReturnType<typeof dashboardDataFrameV2Schema.parse> {
	return dashboardDataFrameV2Schema.parse({
		...frame,
		fields: frame.fields.map((field) => ({
			...field,
			values: [shapeProbeValue(field)],
		})),
	});
}

function shapeProbeValue(
	field: ReturnType<typeof dashboardFieldV2Schema.parse>,
): number | string | boolean {
	switch (field.type) {
		case "time":
			return field.roles.includes("end-time") ? 1 : 0;
		case "number":
			return 0;
		case "string":
			return "value";
		case "boolean":
			return false;
	}
}

function assertPlainRecord(
	value: object,
): asserts value is Record<string, unknown> {
	if (Array.isArray(value)) throw new TypeError("rows must be plain records");
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new TypeError("rows must be plain records");
}

function convertCell(
	value: unknown,
	type: DashboardFieldType,
): number | string | boolean | null {
	if (value === null) return null;
	if (value === undefined) throw new TypeError("cell value is undefined");
	switch (type) {
		case "time": {
			const time = value instanceof Date ? value.getTime() : value;
			if (typeof time !== "number" || !Number.isSafeInteger(time))
				throw new TypeError(
					"time value must be a valid Date or epoch milliseconds",
				);
			return time;
		}
		case "number":
			if (typeof value !== "number" || !Number.isFinite(value))
				throw new TypeError("number value must be finite");
			return value;
		case "string":
			if (typeof value !== "string")
				throw new TypeError("string value is required");
			return value;
		case "boolean":
			if (typeof value !== "boolean")
				throw new TypeError("boolean value is required");
			return value;
	}
}
