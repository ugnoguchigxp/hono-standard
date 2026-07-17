import type {
	DashboardNoticeV2,
	PanelDataStateV2,
	PanelQueryResponseV2,
} from "./transport-v2.schema";
import { DASHBOARD_V2_LIMITS } from "./common.schema";
import {
	dashboardDataFrameV2Schema,
	type DashboardDataFrameV2,
} from "./data-frame.schema";
import type { DashboardJsonObject } from "./json-value.schema";
import {
	standardFieldConfigV2Schema,
	type FieldUnitV2,
	type PanelLinkV2,
} from "./field-config.schema";
import {
	dashboardManifestV2Schema,
	type DashboardManifestV2,
	type PanelManifestV2,
	type PublicDashboardManifestV2,
} from "./manifest-v2.schema";
import {
	panelQueryRequestV2Schema,
	panelQueryResponseV2Schema,
	variableOptionsRequestV2Schema,
	variableOptionsResponseV2Schema,
} from "./transport-v2.schema";
import {
	dashboardManifestSchema,
	panelDataStateSchema,
	panelDataSchema,
	panelManifestSchema,
	panelQueryRequestSchema,
	panelQueryResponseSchema,
	publicDashboardManifestSchema,
	variableOptionsRequestSchema,
	variableOptionsResponseSchema,
	type DashboardManifest,
	type PanelData,
	type PanelDataState,
	type PanelManifest,
	type PanelQueryRequest,
	type PanelQueryResponse,
	type PanelVisualization,
	type PublicDashboardManifest,
	type VariableOptionsRequest,
	type VariableOptionsResponse,
} from "./legacy-v1.schema";

export class DashboardCompatibilityError extends Error {
	readonly code:
		| "INVALID_LEGACY_DATA"
		| "INVALID_LEGACY_MANIFEST"
		| "NOTICE_LIMIT_EXCEEDED";
	readonly path?: Array<string | number>;
	constructor(
		code:
			| "INVALID_LEGACY_DATA"
			| "INVALID_LEGACY_MANIFEST"
			| "NOTICE_LIMIT_EXCEEDED",
		message: string,
		path?: Array<string | number>,
	) {
		super(message);
		this.name = "DashboardCompatibilityError";
		this.code = code;
		this.path = path;
	}
}

const notice = (
	code: string,
	message: string,
	severity: "info" | "warning" = "warning",
): DashboardNoticeV2 => ({ code, message, severity });
const unit = (value: string): FieldUnitV2 => {
	if (!value) return { kind: "none" };
	if (value === "%") return { kind: "percent", scale: "hundred" };
	if (["ns", "us", "ms", "s", "m", "h", "d"].includes(value))
		return {
			kind: "duration",
			unit: value as "ns" | "us" | "ms" | "s" | "m" | "h" | "d",
		};
	if (value === "B") return { kind: "bytes", base: 1000 };
	if (value === "bytes") return { kind: "bytes", base: 1024 };
	if (/^.+\/s$/.test(value)) return { kind: "rate", suffix: value };
	return { kind: "custom", suffix: value.slice(0, 16) };
};
const fieldConfig = (
	meta?: { unit?: string; decimalPlaces?: number; colorToken?: string },
	extra: Record<string, unknown> = {},
) =>
	standardFieldConfigV2Schema.parse({
		unit: unit(meta?.unit ?? ""),
		decimals: meta?.decimalPlaces ?? "auto",
		...extra,
		...(meta?.colorToken
			? { color: { mode: "fixed", token: meta.colorToken } }
			: {}),
	});

export function legacyFieldKeyToV2(
	value: string,
	usedKeys: Set<string>,
): { key: string; sanitized: boolean } {
	const original = value;
	let key =
		value
			.trim()
			.replace(/[^A-Za-z0-9_.:-]+/g, "_")
			.replace(/^([^A-Za-z_])/, "_$1")
			.replace(/_+/g, "_") || "field";
	key = key.slice(0, 80);
	let suffix = 2;
	const base = key;
	while (usedKeys.has(key)) {
		const tail = `_${suffix}`;
		key = `${base.slice(0, 80 - tail.length)}${tail}`;
		suffix += 1;
	}
	usedKeys.add(key);
	return { key, sanitized: key !== original };
}

const appendNotice = (
	notices: DashboardNoticeV2[],
	next: DashboardNoticeV2,
) => {
	if (!notices.some((item) => item.code === next.code)) notices.push(next);
	if (notices.length > DASHBOARD_V2_LIMITS.maxNotices)
		throw new DashboardCompatibilityError(
			"NOTICE_LIMIT_EXCEEDED",
			"compatibility notices exceed the limit",
		);
};

export function legacyPanelDataToFrames(
	data: PanelData,
	options: { refId: string; queryRefId?: string; frameName: string },
): { frames: DashboardDataFrameV2[]; notices: DashboardNoticeV2[] } {
	const parsed = panelDataSchema.safeParse(data);
	if (!parsed.success)
		throw new DashboardCompatibilityError(
			"INVALID_LEGACY_DATA",
			"legacy panel data does not satisfy the v1 schema",
		);
	const value = parsed.data;
	const notices: DashboardNoticeV2[] = [];
	const source = {
		kind: "query" as const,
		refId: options.queryRefId ?? options.refId,
	};
	if (value.kind === "timeseries") {
		const used = new Set<string>();
		const mappings = value.series.map((item) => ({
			...item,
			legacyKey: item.key,
			...legacyFieldKeyToV2(item.key, used),
		}));
		if (mappings.some((item) => item.sanitized))
			appendNotice(
				notices,
				notice(
					"LEGACY_FIELD_KEYS_SANITIZED",
					`${mappings.filter((item) => item.sanitized).length} legacy field keys were sanitized.`,
				),
			);
		const keys = new Set(value.series.map((item) => item.key));
		for (const [rowIndex, row] of value.rows.entries())
			for (const key of Object.keys(row.values))
				if (!keys.has(key))
					throw new DashboardCompatibilityError(
						"INVALID_LEGACY_DATA",
						`unknown series key: ${key}`,
						["rows", rowIndex, "values", key],
					);
		const fields: DashboardDataFrameV2["fields"] = [
			{
				key: "time",
				label: "Time",
				type: "time",
				roles: ["time"],
				labels: {},
				values: value.rows.map((row) => row.time),
			},
			...mappings.map((item) => ({
				key: item.key,
				label: item.label,
				type: "number" as const,
				roles: ["value" as const],
				labels: {},
				values: value.rows.map((row) => row.values[item.legacyKey] ?? null),
				config: fieldConfig(item),
			})),
		];
		return {
			frames: [
				dashboardDataFrameV2Schema.parse({
					schemaVersion: 2,
					refId: options.refId,
					source,
					name: options.frameName,
					fields,
					meta: { shapeHint: "timeseries" },
				}),
			],
			notices,
		};
	}
	if (value.kind === "category") {
		const used = new Set(["category"]);
		const mappings = value.series.map((item) => ({
			...item,
			legacyKey: item.key,
			...legacyFieldKeyToV2(item.key, used),
		}));
		if (mappings.some((item) => item.sanitized))
			appendNotice(
				notices,
				notice(
					"LEGACY_FIELD_KEYS_SANITIZED",
					`${mappings.filter((item) => item.sanitized).length} legacy field keys were sanitized.`,
				),
			);
		const fields: DashboardDataFrameV2["fields"] = [
			{
				key: "category",
				label: "Category",
				type: "string",
				roles: ["category"],
				labels: {},
				values: value.rows.map((row) => row.category),
			},
			...mappings.map((item) => ({
				key: item.key,
				label: item.label,
				type: "number" as const,
				roles: ["value" as const],
				labels: {},
				values: value.rows.map((row) => row.values[item.legacyKey] ?? null),
				config: fieldConfig(item),
			})),
		];
		return {
			frames: [
				dashboardDataFrameV2Schema.parse({
					schemaVersion: 2,
					refId: options.refId,
					source,
					name: options.frameName,
					fields,
					meta: { shapeHint: "category" },
				}),
			],
			notices,
		};
	}
	if (value.kind === "stat") {
		const metadata = value.series;
		const fields: DashboardDataFrameV2["fields"] = [
			{
				key: "value",
				label: metadata?.label ?? "Value",
				type: "number",
				roles: ["value"],
				labels: {},
				values: value.value === null ? [] : [value.value],
				config: fieldConfig(metadata),
			},
		];
		if (value.previous !== undefined)
			fields.push({
				key: "previous",
				label: "Previous",
				type: "number",
				roles: ["previous"],
				labels: {},
				values: value.value === null ? [] : [value.previous],
			});
		if (value.delta !== undefined)
			fields.push({
				key: "delta",
				label: "Delta",
				type: "number",
				roles: ["delta"],
				labels: {},
				values: value.value === null ? [] : [value.delta],
			});
		return {
			frames: [
				dashboardDataFrameV2Schema.parse({
					schemaVersion: 2,
					refId: options.refId,
					source,
					name: options.frameName,
					fields,
					meta: { shapeHint: "scalar" },
				}),
			],
			notices,
		};
	}
	const columns = value.columns;
	const used = new Set<string>();
	const mappings = columns.map((column) => ({
		...column,
		...legacyFieldKeyToV2(column.key, used),
	}));
	if (mappings.some((item) => item.sanitized))
		appendNotice(
			notices,
			notice(
				"LEGACY_FIELD_KEYS_SANITIZED",
				`${mappings.filter((item) => item.sanitized).length} legacy field keys were sanitized.`,
			),
		);
	let mixed = 0;
	const fields = mappings.map((column) => {
		const sourceValues = value.rows.map((row) => row[column.key] ?? null);
		const nonNull = sourceValues.filter((item) => item !== null);
		const types = new Set(nonNull.map((item) => typeof item));
		const type =
			types.size === 1 && types.has("number")
				? "number"
				: types.size === 1 && types.has("boolean")
					? "boolean"
					: types.size === 1 && types.has("string")
						? "string"
						: "string";
		if (types.size > 1) {
			mixed += 1;
		}
		const coerced =
			type === "string"
				? sourceValues.map((item) => (item === null ? null : String(item)))
				: sourceValues;
		return {
			key: column.key,
			label: column.label,
			type,
			roles: [],
			labels: {},
			values: coerced,
			config: fieldConfig(column, { textAlign: column.align }),
		} as DashboardDataFrameV2["fields"][number];
	});
	if (mixed)
		appendNotice(
			notices,
			notice(
				"LEGACY_MIXED_COLUMN_COERCED",
				`${mixed} mixed legacy table columns were coerced to strings.`,
			),
		);
	return {
		frames: [
			dashboardDataFrameV2Schema.parse({
				schemaVersion: 2,
				refId: options.refId,
				source,
				name: options.frameName,
				fields,
				meta: { shapeHint: "table" },
			}),
		],
		notices,
	};
}

function legacyLink(
	link: PanelVisualization["links"][number],
	index: number,
): PanelLinkV2 {
	const search: Record<string, PanelLinkV2["search"][string]> = {};
	for (const [key, source] of Object.entries(link.search)) {
		if (source.kind === "field")
			search[key] = { kind: "field", fieldKey: source.key };
		else if (source.kind === "filter")
			search[key] = { kind: "filter", variableId: source.key, format: "comma" };
		else search[key] = { kind: "constant", value: source.value };
	}
	return {
		id: `link-${index + 1}`,
		title: link.targetId,
		targetId: link.targetId,
		to: link.to,
		search,
		includeRange: link.includeRange,
		includeFilters: link.includeFilters,
		openInNewTab: false,
	};
}

export function legacyVisualizationToV2(
	visualization: PanelVisualization,
): DashboardManifestV2["panels"][number]["visualization"] {
	const mapping = {
		line: ["core.timeseries", "line"],
		area: ["core.timeseries", "area"],
		bar: ["core.bar", "vertical"],
		stat: ["core.stat", "value"],
		table: ["core.table", "table"],
	} as const;
	const [type, preset] = mapping[visualization.type];
	const thresholds = visualization.thresholds.length
		? {
				mode: "absolute" as const,
				steps: [
					{ value: null, colorToken: "--color-muted" },
					...visualization.thresholds.map((item) => ({
						value: item.value,
						colorToken: item.colorToken,
						...(item.label ? { label: item.label } : {}),
					})),
				],
			}
		: undefined;
	const options = {
		showLegend: visualization.showLegend,
		fill: visualization.fill,
		connectNulls: visualization.connectNulls,
		yAxisScale: visualization.yAxisScale,
		yAxisMin: visualization.yAxisMin,
		yAxisMax: visualization.yAxisMax,
		referenceLines: visualization.referenceLines,
	} as DashboardJsonObject;
	return {
		type,
		preset,
		frameRefs: ["A"],
		options,
		fieldConfig: standardFieldConfigV2Schema.parse({
			unit: unit(visualization.unit),
			decimals: visualization.decimalPlaces,
			thresholds,
			valueMappings: visualization.valueMappings.map((item) => ({
				kind: item.type,
				...(item.type === "value"
					? { value: item.value }
					: item.type === "range"
						? { from: item.from, to: item.to }
						: {}),
				text: item.label,
				...(item.colorToken ? { colorToken: item.colorToken } : {}),
			})),
		}),
		overrides: [],
		tableFallback: { enabled: true, defaultView: "visualization" },
	};
}

export function legacyPanelManifestToV2(panel: PanelManifest): PanelManifestV2 {
	const parsed = panelManifestSchema.parse(panel);
	return dashboardManifestV2Schema.shape.panels.element.parse({
		id: parsed.id,
		title: parsed.title,
		description: parsed.description,
		layout: { ...parsed.layout, minW: 1, minH: 1 },
		queries: [
			{
				refId: "A",
				queryId: parsed.queryId,
				outputFrameRefs: ["A"],
				hidden: false,
			},
		],
		transformations: [],
		visualization: legacyVisualizationToV2(parsed.visualization),
		accessibleLabel: parsed.accessibleLabel,
		links: parsed.visualization.links.map(legacyLink),
	});
}

const variableToV2 = (variable: DashboardManifest["variables"][number]) => ({
	id: variable.id,
	label: variable.label,
	selection: variable.selection,
	required: variable.required,
	defaultValues: variable.defaultValues,
	dependsOn: variable.dependsOn,
	source:
		variable.source.kind === "static"
			? {
					kind: "static" as const,
					options: variable.source.options.map((option) => ({
						...option,
						disabled: false,
					})),
				}
			: variable.source,
});
export function legacyDashboardManifestToV2(
	manifest: DashboardManifest,
): DashboardManifestV2 {
	const parsed = dashboardManifestSchema.parse(manifest);
	return dashboardManifestV2Schema.parse({
		schemaVersion: 2,
		revision: 1,
		id: parsed.id,
		title: parsed.title,
		description: parsed.description,
		layoutVersion: parsed.layoutVersion,
		defaultRange: parsed.defaultRange,
		defaultTimezone: parsed.defaultTimezone,
		defaultRefreshSeconds: parsed.defaultRefreshSeconds,
		variables: parsed.variables.map(variableToV2),
		panels: parsed.panels.map(legacyPanelManifestToV2),
		inspectorEnabled: parsed.inspectorEnabled,
	});
}
export function legacyPublicDashboardManifestToV2(
	manifest: PublicDashboardManifest,
): PublicDashboardManifestV2 {
	const parsed = publicDashboardManifestSchema.parse(manifest);
	const full = legacyDashboardManifestToV2({
		...parsed,
		variables: parsed.variables.map((variable) =>
			variable.source.kind === "static"
				? {
						...variable,
						source: {
							kind: "static" as const,
							options: (variable.defaultValues.length > 0
								? variable.defaultValues
								: ["__empty__"]
							).map((value) => ({
								value,
								label: value,
							})),
						},
					}
				: variable,
		),
	} as DashboardManifest);
	return {
		...full,
		variables: full.variables.map((variable) => ({
			...variable,
			source:
				variable.source.kind === "static"
					? { kind: "static" as const }
					: variable.source,
		})),
	};
}
export function legacyPanelDataStateToV2(
	state: PanelDataState,
): PanelDataStateV2 {
	const legacy = panelDataStateSchema.parse(state);
	return {
		emptyReason: legacy.emptyReason,
		partial: legacy.partial ?? false,
		truncated: false,
		notices: (legacy.warnings ?? []).map((message) =>
			notice("LEGACY_WARNING", message),
		),
		dataThrough: legacy.dataThrough,
		staleAfterMs: legacy.staleAfterMs,
	};
}
export function legacyPanelQueryRequestToV2(
	request: PanelQueryRequest,
): ReturnType<typeof panelQueryRequestV2Schema.parse> {
	const value = panelQueryRequestSchema.parse(request);
	return panelQueryRequestV2Schema.parse({
		schemaVersion: 2,
		...value,
		maxRows: 2000,
	});
}
export function legacyVariableOptionsRequestToV2(
	request: VariableOptionsRequest,
): ReturnType<typeof variableOptionsRequestV2Schema.parse> {
	const value = variableOptionsRequestSchema.parse(request);
	return variableOptionsRequestV2Schema.parse({ schemaVersion: 2, ...value });
}
export function legacyVariableOptionsResponseToV2(
	response: VariableOptionsResponse,
): ReturnType<typeof variableOptionsResponseV2Schema.parse> {
	const value = variableOptionsResponseSchema.parse(response);
	return variableOptionsResponseV2Schema.parse({
		schemaVersion: 2,
		variableId: value.variableId,
		options: value.options.map((option) => ({ ...option, disabled: false })),
	});
}
export function legacyPanelQueryResponseToV2(
	response: PanelQueryResponse,
	options: { refId: string; queryRefId?: string; frameName: string },
): PanelQueryResponseV2 {
	const parsed = panelQueryResponseSchema.parse(response);
	const converted = legacyPanelDataToFrames(parsed.data, options);
	const state = legacyPanelDataStateToV2(parsed.state);
	state.notices = [...state.notices, ...converted.notices];
	if (state.notices.length > DASHBOARD_V2_LIMITS.maxNotices)
		throw new DashboardCompatibilityError(
			"NOTICE_LIMIT_EXCEEDED",
			"compatibility notices exceed the limit",
		);
	const counts = {
		frames: converted.frames.length,
		fields: converted.frames.reduce(
			(sum, frame) => sum + frame.fields.length,
			0,
		),
		rows: converted.frames.reduce(
			(sum, frame) => sum + (frame.fields[0]?.values.length ?? 0),
			0,
		),
		cells: converted.frames.reduce(
			(sum, frame) =>
				sum + frame.fields.length * (frame.fields[0]?.values.length ?? 0),
			0,
		),
	};
	return panelQueryResponseV2Schema.parse({
		schemaVersion: 2,
		requestId: parsed.requestId,
		generatedAt: parsed.generatedAt,
		resolvedRange: parsed.resolvedRange,
		intervalMs: parsed.intervalMs,
		durationMs: parsed.durationMs,
		counts,
		state: {
			...state,
			emptyReason:
				counts.rows === 0 ? (state.emptyReason ?? "no-records") : undefined,
		},
		frames: converted.frames,
	});
}
