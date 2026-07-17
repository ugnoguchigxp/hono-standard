import {
	DASHBOARD_LIMITS,
	type PanelData,
	type PanelDataState,
	panelDataSchema,
	panelDataStateSchema,
} from "../../../shared/schemas/dashboard.schema";
import { bucketStarts } from "./interval";
import type { ResolvedRange } from "./types";

export class DashboardNormalizationError extends Error {
	readonly code:
		| "INVALID_HANDLER_RESULT"
		| "SERIES_LIMIT_EXCEEDED"
		| "ROW_LIMIT_EXCEEDED"
		| "DUPLICATE_TIMESTAMP";

	constructor(code: DashboardNormalizationError["code"], message: string) {
		super(message);
		this.name = "DashboardNormalizationError";
		this.code = code;
	}
}

type NormalizeOptions = {
	data: unknown;
	resolvedRange: ResolvedRange;
	intervalMs: number;
	maxDataPoints: number;
	fill: "null" | "zero" | "previous";
	state?: unknown;
};

export type NormalizedPanelResult = {
	data: PanelData;
	state: PanelDataState;
	rowCount: number;
	seriesCount: number;
};

export function normalizePanelResult(
	options: NormalizeOptions,
): NormalizedPanelResult {
	const parsed = panelDataSchema.safeParse(options.data);
	if (!parsed.success)
		throw new DashboardNormalizationError(
			"INVALID_HANDLER_RESULT",
			"Handler result did not match PanelData",
		);
	const data = parsed.data;
	const stateParsed = panelDataStateSchema.safeParse(options.state ?? {});
	if (!stateParsed.success)
		throw new DashboardNormalizationError(
			"INVALID_HANDLER_RESULT",
			"Handler state did not match PanelDataState",
		);
	const handlerState = stateParsed.data;
	const series =
		data.kind === "timeseries" || data.kind === "category"
			? data.series
			: data.kind === "stat" && data.series
				? [data.series]
				: [];
	if (series.length > DASHBOARD_LIMITS.maxSeries) {
		throw new DashboardNormalizationError(
			"SERIES_LIMIT_EXCEEDED",
			"Panel returned too many series",
		);
	}
	const seriesKeys = new Set(series.map((item) => item.key));
	if (seriesKeys.size !== series.length) {
		throw new DashboardNormalizationError(
			"INVALID_HANDLER_RESULT",
			"Series keys must be unique",
		);
	}

	if (data.kind === "timeseries") {
		if (data.rows.length > options.maxDataPoints)
			throw new DashboardNormalizationError(
				"ROW_LIMIT_EXCEEDED",
				"Panel returned too many rows",
			);
		const sorted = [...data.rows].sort((a, b) => a.time - b.time);
		for (let index = 1; index < sorted.length; index += 1) {
			if (sorted[index - 1]?.time === sorted[index]?.time)
				throw new DashboardNormalizationError(
					"DUPLICATE_TIMESTAMP",
					"Timeseries contains duplicate timestamps",
				);
		}
		for (const row of sorted) {
			for (const key of Object.keys(row.values)) {
				if (!seriesKeys.has(key))
					throw new DashboardNormalizationError(
						"INVALID_HANDLER_RESULT",
						`Unknown series key: ${key}`,
					);
			}
		}
		if (sorted.length === 0) {
			if (!handlerState.emptyReason)
				throw new DashboardNormalizationError(
					"INVALID_HANDLER_RESULT",
					"Empty timeseries must declare emptyReason",
				);
			return {
				data,
				state: handlerState,
				rowCount: 0,
				seriesCount: data.series.length,
			};
		}
		const byTime = new Map(sorted.map((row) => [row.time, row.values]));
		const rows = bucketStarts(options.resolvedRange, options.intervalMs)
			.slice(0, options.maxDataPoints)
			.map((time) => {
				const timeKey = time.getTime();
				const existing = byTime.get(timeKey);
				if (existing) return { time: timeKey, values: existing };
				const values: Record<string, number | null> = {};
				for (const key of seriesKeys) {
					if (options.fill === "zero") values[key] = 0;
					else if (options.fill === "previous")
						values[key] = findPrevious(sorted, timeKey, key);
					else values[key] = null;
				}
				return { time: timeKey, values };
			});
		const state: PanelDataState =
			rows.length === 0
				? handlerState.emptyReason
					? handlerState
					: { emptyReason: "no-records", partial: false, warnings: [] }
				: handlerState;
		return {
			data: { ...data, rows },
			state,
			rowCount: rows.length,
			seriesCount: data.series.length,
		};
	}
	if (data.kind === "category") {
		if (data.rows.length > options.maxDataPoints)
			throw new DashboardNormalizationError(
				"ROW_LIMIT_EXCEEDED",
				"Panel returned too many rows",
			);
		const seen = new Set<string>();
		for (const row of data.rows) {
			if (seen.has(row.category))
				throw new DashboardNormalizationError(
					"INVALID_HANDLER_RESULT",
					"Category values must be unique",
				);
			seen.add(row.category);
			for (const key of Object.keys(row.values))
				if (!seriesKeys.has(key))
					throw new DashboardNormalizationError(
						"INVALID_HANDLER_RESULT",
						`Unknown series key: ${key}`,
					);
		}
		const rows = [...data.rows].sort((a, b) =>
			a.category.localeCompare(b.category),
		);
		if (rows.length === 0 && !handlerState.emptyReason)
			throw new DashboardNormalizationError(
				"INVALID_HANDLER_RESULT",
				"Empty category must declare emptyReason",
			);
		return {
			data: { ...data, rows },
			state: rows.length ? handlerState : handlerState,
			rowCount: rows.length,
			seriesCount: data.series.length,
		};
	}
	if (data.kind === "table") {
		if (data.rows.length > DASHBOARD_LIMITS.maxTableRows)
			throw new DashboardNormalizationError(
				"ROW_LIMIT_EXCEEDED",
				"Table returned too many rows",
			);
		const columnKeys = new Set(data.columns.map((column) => column.key));
		if (columnKeys.size !== data.columns.length)
			throw new DashboardNormalizationError(
				"INVALID_HANDLER_RESULT",
				"Table column keys must be unique",
			);
		const rows = data.rows.map((row) => {
			for (const key of Object.keys(row))
				if (!columnKeys.has(key))
					throw new DashboardNormalizationError(
						"INVALID_HANDLER_RESULT",
						`Unknown table column: ${key}`,
					);
			return Object.fromEntries(
				data.columns.map((column) => [column.key, row[column.key] ?? null]),
			);
		});
		if (rows.length === 0 && !handlerState.emptyReason)
			throw new DashboardNormalizationError(
				"INVALID_HANDLER_RESULT",
				"Empty table must declare emptyReason",
			);
		return {
			data: { ...data, rows },
			state: handlerState,
			rowCount: data.rows.length,
			seriesCount: 0,
		};
	}
	const delta =
		data.delta ??
		(data.value !== null &&
		data.previous !== null &&
		data.previous !== undefined
			? data.value - data.previous
			: undefined);
	if (data.value === null && !handlerState.emptyReason)
		throw new DashboardNormalizationError(
			"INVALID_HANDLER_RESULT",
			"Empty stat must declare emptyReason",
		);
	return {
		data: { ...data, delta },
		state: handlerState,
		rowCount: data.value === null ? 0 : 1,
		seriesCount: data.series ? 1 : 0,
	};
}

function findPrevious(
	rows: Extract<PanelData, { kind: "timeseries" }>["rows"],
	time: number,
	key: string,
): number | null {
	let previous: number | null = null;
	for (const row of rows) {
		if (row.time >= time) break;
		const value = row.values[key];
		if (value !== undefined && value !== null) previous = value;
	}
	return previous;
}
