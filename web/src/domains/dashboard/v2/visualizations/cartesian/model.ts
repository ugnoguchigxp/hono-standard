import type {
	DashboardDataFrameV2,
	StandardFieldConfigV2,
} from "@shared/schemas/dashboard.schema";
import { standardFieldConfigV2Schema } from "@shared/schemas/dashboard.schema";

export type CartesianDomainValue = number | string;
export type CartesianSeriesModel = {
	key: string;
	frameRefId: string;
	fieldKey: string;
	label: string;
	values: Array<number | null>;
	fieldConfig: StandardFieldConfigV2;
};
export type CartesianRowModel = {
	domain: CartesianDomainValue;
	values: Record<string, number | null>;
	raw: Record<string, string | number | boolean | null>;
};
export type CartesianModel = {
	domainKind: "time" | "category";
	rows: CartesianRowModel[];
	series: CartesianSeriesModel[];
};

type DashboardField = DashboardDataFrameV2["fields"][number];
export type CartesianModelOptions = {
	resolveFieldConfig?: (
		frame: DashboardDataFrameV2,
		field: DashboardField,
	) => StandardFieldConfigV2;
};

function fieldConfig(
	frame: DashboardDataFrameV2,
	field: DashboardField,
	options: CartesianModelOptions,
) {
	return (
		options.resolveFieldConfig?.(frame, field) ??
		standardFieldConfigV2Schema.parse(field.config ?? {})
	);
}

function valueFields(frames: DashboardDataFrameV2[]) {
	return frames.flatMap((frame) =>
		frame.fields
			.filter(
				(field) => field.type === "number" && field.roles.includes("value"),
			)
			.map((field) => ({
				frame,
				field,
				key: frames.length > 1 ? `${frame.refId}:${field.key}` : field.key,
			})),
	);
}

function normalizeDomain(
	value: DashboardField["values"][number],
	role: "time" | "category",
): CartesianDomainValue {
	const domain =
		value === null ? "—" : role === "time" ? Number(value) : String(value);
	if (
		role === "time" &&
		(typeof domain !== "number" || !Number.isFinite(domain))
	)
		throw new Error("INVALID_CARTESIAN_DOMAIN");
	return domain;
}

function frameDomainIndexes(
	frames: DashboardDataFrameV2[],
	role: "time" | "category",
) {
	return frames.map((frame) => {
		const domainField = frame.fields.find((item) => item.roles.includes(role));
		if (!domainField) throw new Error("INVALID_CARTESIAN_DOMAIN");
		const indexes = new Map<string, number>();
		for (const [index, value] of domainField.values.entries()) {
			const key = String(normalizeDomain(value, role));
			if (indexes.has(key)) throw new Error("DUPLICATE_CARTESIAN_DOMAIN");
			indexes.set(key, index);
		}
		return { frame, domainField, indexes };
	});
}

function rowsForDomain(
	indexes: ReturnType<typeof frameDomainIndexes>,
	role: "time" | "category",
): CartesianDomainValue[] {
	const domains: Array<number | string> = [];
	const seen = new Set<string>();
	for (const { domainField } of indexes) {
		for (const value of domainField.values) {
			const domain = normalizeDomain(value, role);
			const key = String(domain);
			if (!seen.has(key)) {
				seen.add(key);
				domains.push(domain);
			}
		}
	}
	return role === "time"
		? domains.sort((a, b) => Number(a) - Number(b))
		: domains;
}

export function buildCartesianModel(
	frames: DashboardDataFrameV2[],
	role: "time" | "category",
	options: CartesianModelOptions = {},
): CartesianModel {
	const fields = valueFields(frames);
	const indexes = frameDomainIndexes(frames, role);
	const domains = rowsForDomain(indexes, role);
	const series: CartesianSeriesModel[] = fields.map(({ frame, field, key }) => {
		const frameIndexes = indexes.find((item) => item.frame === frame);
		if (!frameIndexes) throw new Error("INVALID_CARTESIAN_DOMAIN");
		const effectiveConfig = fieldConfig(frame, field, options);
		return {
			key,
			frameRefId: frame.refId,
			fieldKey: field.key,
			label: effectiveConfig.displayName ?? field.label,
			values: domains.map((domain) => {
				const index = frameIndexes.indexes.get(String(domain));
				return index === undefined || field.type !== "number"
					? null
					: (field.values[index] ?? null);
			}),
			fieldConfig: effectiveConfig,
		};
	});
	const rows = domains.map((domain, index) => ({
		domain,
		values: Object.fromEntries(
			series.map((item) => [item.key, item.values[index] ?? null]),
		),
		raw: Object.fromEntries(
			indexes.flatMap(({ frame, indexes: domainIndexes }) => {
				const sourceIndex = domainIndexes.get(String(domain));
				if (sourceIndex === undefined) return [];
				return frame.fields.map((field) => [
					frames.length > 1 ? `${frame.refId}:${field.key}` : field.key,
					field.values[sourceIndex] ?? null,
				]);
			}),
		),
	}));
	return { domainKind: role, rows, series };
}

export function normalizePercentRows(
	model: CartesianModel,
	includedSeriesKeys = model.series.map((series) => series.key),
) {
	const included = new Set(includedSeriesKeys);
	return model.rows.map((row) => {
		const total = Object.entries(row.values).reduce(
			(sum, [key, value]) => sum + (included.has(key) ? (value ?? 0) : 0),
			0,
		);
		return {
			...row,
			values: Object.fromEntries(
				Object.entries(row.values).map(([key, value]) => [
					key,
					included.has(key)
						? total === 0 || value === null
							? 0
							: (value / total) * 100
						: value,
				]),
			),
		};
	});
}

export function resolveCartesianSeriesKey(
	model: CartesianModel,
	fieldKey: string,
) {
	const exact = model.series.find((series) => series.key === fieldKey);
	if (exact) return exact.key;
	const matches = model.series.filter((series) => series.fieldKey === fieldKey);
	if (matches.length === 0) throw new Error("CARTESIAN_SERIES_MISSING");
	if (matches.length > 1) throw new Error("CARTESIAN_SERIES_AMBIGUOUS");
	const match = matches[0];
	if (!match) throw new Error("CARTESIAN_SERIES_MISSING");
	return match.key;
}

export type RangeBandRow = CartesianRowModel & {
	lower: number | null;
	upper: number | null;
	width: number | null;
};
export function buildRangeBandRows(
	model: CartesianModel,
	lowerKey: string,
	upperKey: string,
): RangeBandRow[] {
	return model.rows.map((row) => {
		const lower = row.values[lowerKey] ?? null;
		const upper = row.values[upperKey] ?? null;
		return {
			...row,
			lower,
			upper,
			width: lower === null || upper === null ? null : upper - lower,
		};
	});
}

export type WaterfallRow = CartesianRowModel & {
	delta: number;
	start: number;
	end: number;
	range: [number, number];
	state: "positive" | "negative" | "zero" | "total";
	synthetic?: boolean;
};
export function buildWaterfallRows(
	model: CartesianModel,
	valueKey: string,
	showTotal = true,
	totalLabel = "Total",
) {
	let cumulative = 0;
	const rows: WaterfallRow[] = model.rows.map((row) => {
		const delta = row.values[valueKey] ?? 0;
		const start = cumulative;
		cumulative += delta;
		return {
			...row,
			delta,
			start,
			end: cumulative,
			range: [Math.min(start, cumulative), Math.max(start, cumulative)],
			state: delta > 0 ? "positive" : delta < 0 ? "negative" : "zero",
		};
	});
	if (showTotal)
		rows.push({
			domain: totalLabel,
			values: { [valueKey]: cumulative },
			raw: {},
			delta: 0,
			start: 0,
			end: cumulative,
			range: [Math.min(0, cumulative), Math.max(0, cumulative)],
			state: "total",
			synthetic: true,
		});
	return rows;
}

export function inferComposedSeries(model: CartesianModel) {
	if (model.series.length < 2) throw new Error("COMPOSED_REQUIRES_TWO_SERIES");
	return model.series.map((series, index) => ({
		fieldKey: series.key,
		mark: index === 0 ? ("bar" as const) : ("line" as const),
		axis: index === 0 ? ("left" as const) : ("right" as const),
		lineStyle: "linear" as const,
	}));
}
