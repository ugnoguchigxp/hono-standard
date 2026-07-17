import type { HeatmapConfigV1 } from "@shared/schemas/dashboard/distribution-visualizations.schema";
import type {
	DashboardDataFrameV2,
	DashboardFieldV2,
} from "@shared/schemas/dashboard.schema";

export type MatrixCell = {
	xKey: string;
	yKey: string;
	xLabel: string;
	yLabel: string;
	value: number | null;
	state?: string;
	missing: boolean;
	explicitNull: boolean;
};
export type MatrixModel = {
	x: string[];
	y: string[];
	xKeys: string[];
	yKeys: string[];
	cells: MatrixCell[];
	values: number[];
};
const field = (
	frame: DashboardDataFrameV2,
	key: string | undefined,
	role: string,
) =>
	frame.fields.find((item) =>
		key ? item.key === key : item.roles.includes(role as never),
	);
const identity = (value: unknown) => `${typeof value}:${String(value)}`;
const label = (
	value: unknown,
	field: DashboardFieldV2,
	locale: string,
	timezone: string,
) =>
	field.type === "time" && typeof value === "number"
		? new Intl.DateTimeFormat(locale, {
				timeZone: timezone,
				dateStyle: "medium",
				timeStyle: "short",
			}).format(value)
		: String(value);

export function buildMatrixModel(
	frame: DashboardDataFrameV2,
	config: HeatmapConfigV1,
	options: { locale?: string; timezone?: string } = {},
): MatrixModel {
	const locale = options.locale ?? "en-US";
	const timezone = options.timezone ?? "UTC";
	const xField = field(frame, config.xFieldKey, "x");
	const yField = field(frame, config.yFieldKey, "y");
	const valueField =
		field(frame, config.valueFieldKey, "value") ??
		field(frame, config.valueFieldKey, "count");
	if (!xField || !yField || !valueField)
		throw new Error("MATRIX_FIELDS_MISSING");
	if (valueField.type !== "number") throw new Error("MATRIX_VALUE_NOT_NUMERIC");
	const stateField = frame.fields.find((item) => item.roles.includes("state"));
	if (
		xField.values.length !== yField.values.length ||
		xField.values.length !== valueField.values.length ||
		(stateField && stateField.values.length !== xField.values.length)
	)
		throw new Error("MATRIX_FIELD_LENGTH_MISMATCH");
	const xItems = [
		...new Map<string, { key: string; label: string }>(
			xField.values
				.filter((value) => value !== null)
				.map((value) => {
					const key = identity(value);
					return [key, { key, label: label(value, xField, locale, timezone) }];
				}),
		).values(),
	];
	const yItems = [
		...new Map<string, { key: string; label: string }>(
			yField.values
				.filter((value) => value !== null)
				.map((value) => {
					const key = identity(value);
					return [key, { key, label: label(value, yField, locale, timezone) }];
				}),
		).values(),
	];
	const seen = new Set<string>();
	const cells: MatrixCell[] = [];
	for (
		let row = 0;
		row < Math.max(xField.values.length, yField.values.length);
		row += 1
	) {
		const xValue = xField.values[row];
		const yValue = yField.values[row];
		if (xValue == null || yValue == null) continue;
		const xKey = identity(xValue);
		const yKey = identity(yValue);
		const coordinate = `${xKey}\u0000${yKey}`;
		if (seen.has(coordinate)) throw new Error("MATRIX_DUPLICATE_COORDINATE");
		seen.add(coordinate);
		const raw = valueField.values[row];
		cells.push({
			xKey,
			yKey,
			xLabel: label(xValue, xField, locale, timezone),
			yLabel: label(yValue, yField, locale, timezone),
			value: typeof raw === "number" ? raw : null,
			state: stateField
				? String(stateField.values[row] ?? "unknown")
				: undefined,
			missing: raw === null || raw === undefined,
			explicitNull: raw === null,
		});
	}
	const sort = (
		items: Array<{ key: string; label: string }>,
		mode: HeatmapConfigV1["xSort"],
	) =>
		mode === "input"
			? items
			: [...items].sort((a, b) =>
					mode === "asc"
						? a.label.localeCompare(b.label)
						: b.label.localeCompare(a.label),
				);
	const sortedXItems = sort(xItems, config.xSort);
	const sortedYItems = sort(yItems, config.ySort);
	const populated = new Set(
		cells.map((cell) => JSON.stringify([cell.xKey, cell.yKey])),
	);
	for (const xItem of sortedXItems)
		for (const yItem of sortedYItems) {
			const coordinate = JSON.stringify([xItem.key, yItem.key]);
			if (!populated.has(coordinate))
				cells.push({
					xKey: xItem.key,
					yKey: yItem.key,
					xLabel: xItem.label,
					yLabel: yItem.label,
					value: null,
					missing: true,
					explicitNull: false,
				});
		}
	return {
		x: sortedXItems.map((item) => item.label),
		y: sortedYItems.map((item) => item.label),
		xKeys: sortedXItems.map((item) => item.key),
		yKeys: sortedYItems.map((item) => item.key),
		cells,
		values: cells.flatMap((cell) => (cell.value === null ? [] : [cell.value])),
	};
}
