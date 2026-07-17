import { z } from "zod";

/** Hard limits shared by the API normalizer and the client contract. */
export const DASHBOARD_LIMITS = {
	maxRangeMs: 31 * 24 * 60 * 60 * 1000,
	defaultMaxDataPoints: 800,
	maxDataPoints: 2_000,
	maxSeries: 20,
	absoluteMaxSeries: 50,
	maxTableRows: 2_000,
	maxFilters: 20,
	maxFilterValues: 50,
	maxValueLength: 128,
	maxPanels: 50,
	maxVariables: 20,
	maxPanelIdLength: 64,
	maxDashboardIdLength: 64,
} as const;

export const dashboardEntityIdSchema = z
	.string()
	.regex(/^[a-z][a-z0-9-]*$/)
	.max(DASHBOARD_LIMITS.maxDashboardIdLength);

export const dashboardPanelIdSchema = dashboardEntityIdSchema.max(
	DASHBOARD_LIMITS.maxPanelIdLength,
);

export const relativeRangeValueSchema = z.enum([
	"15m",
	"1h",
	"6h",
	"24h",
	"7d",
]);
export type RelativeRangeValue = z.infer<typeof relativeRangeValueSchema>;

const absoluteRangeSchema = z
	.object({
		kind: z.literal("absolute"),
		from: z.string().datetime({ offset: true }),
		to: z.string().datetime({ offset: true }),
	})
	.superRefine((value, context) => {
		if (Date.parse(value.from) >= Date.parse(value.to)) {
			context.addIssue({
				code: "custom",
				message: "from must be before to",
				path: ["from"],
			});
		}
	});

export const dashboardRangeSchema = z.union([
	z.object({ kind: z.literal("relative"), value: relativeRangeValueSchema }),
	absoluteRangeSchema,
]);
export type DashboardRange = z.infer<typeof dashboardRangeSchema>;

export const dashboardFiltersSchema = z
	.record(
		dashboardEntityIdSchema,
		z
			.array(z.string().trim().min(1).max(DASHBOARD_LIMITS.maxValueLength))
			.max(DASHBOARD_LIMITS.maxFilterValues),
	)
	.refine(
		(filters) => Object.keys(filters).length <= DASHBOARD_LIMITS.maxFilters,
		`no more than ${DASHBOARD_LIMITS.maxFilters} filters are allowed`,
	);
export type DashboardFilters = z.infer<typeof dashboardFiltersSchema>;

export const dashboardTimezoneSchema = z.string().trim().min(1).max(64);

export const dashboardQueryContextSchema = z.object({
	range: dashboardRangeSchema,
	timezone: dashboardTimezoneSchema,
	filters: dashboardFiltersSchema.default({}),
	maxDataPoints: z
		.number()
		.int()
		.min(1)
		.max(DASHBOARD_LIMITS.maxDataPoints)
		.default(DASHBOARD_LIMITS.defaultMaxDataPoints),
});
export type DashboardQueryContext = z.infer<typeof dashboardQueryContextSchema>;

export const chartColorTokenSchema = z
	.string()
	.regex(/^--[a-z0-9]+(?:-[a-z0-9]+)*$/);
export type ChartColorToken = z.infer<typeof chartColorTokenSchema>;

export const seriesMetaSchema = z.object({
	key: z.string().trim().min(1).max(64),
	label: z.string().trim().min(1).max(128),
	unit: z.string().trim().max(32).default(""),
	decimalPlaces: z.number().int().min(0).max(8).default(2),
	colorToken: chartColorTokenSchema.optional(),
});
export type SeriesMeta = z.infer<typeof seriesMetaSchema>;

export const tableColumnSchema = z.object({
	key: z.string().trim().min(1).max(64),
	label: z.string().trim().min(1).max(128),
	unit: z.string().trim().max(32).default(""),
	decimalPlaces: z.number().int().min(0).max(8).default(2),
	align: z.enum(["left", "right"]).default("left"),
});
export type TableColumn = z.infer<typeof tableColumnSchema>;

export const variableOptionSchema = z.object({
	value: z.string().trim().min(1).max(DASHBOARD_LIMITS.maxValueLength),
	label: z.string().trim().min(1).max(128),
});
export type VariableOption = z.infer<typeof variableOptionSchema>;

const staticVariableSourceSchema = z.object({
	kind: z.literal("static"),
	options: z.array(variableOptionSchema).min(1).max(100),
});

const queryVariableSourceSchema = z.object({
	kind: z.literal("query"),
	queryId: dashboardEntityIdSchema,
});

export const variableManifestSchema = z.object({
	id: dashboardEntityIdSchema,
	label: z.string().trim().min(1).max(128),
	selection: z.enum(["single", "multiple"]),
	required: z.boolean().default(false),
	defaultValues: z
		.array(z.string().trim().min(1).max(DASHBOARD_LIMITS.maxValueLength))
		.max(DASHBOARD_LIMITS.maxFilterValues)
		.default([]),
	dependsOn: z
		.array(dashboardEntityIdSchema)
		.max(DASHBOARD_LIMITS.maxVariables)
		.default([]),
	source: z.discriminatedUnion("kind", [
		staticVariableSourceSchema,
		queryVariableSourceSchema,
	]),
});
export type VariableManifest = z.infer<typeof variableManifestSchema>;

export const panelLayoutSchema = z.object({
	x: z.number().int().min(0).max(11),
	y: z.number().int().min(0),
	w: z.number().int().min(1).max(12),
	h: z.number().int().min(1).max(24),
});
export type PanelLayout = z.infer<typeof panelLayoutSchema>;

export const thresholdSchema = z.object({
	value: z.number().finite(),
	colorToken: chartColorTokenSchema,
	label: z.string().trim().max(64).optional(),
});

export const valueMappingSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("value"),
		value: z.union([z.string(), z.number(), z.boolean()]),
		label: z.string().trim().min(1).max(80),
		colorToken: chartColorTokenSchema.optional(),
	}),
	z
		.object({
			type: z.literal("range"),
			from: z.number().finite(),
			to: z.number().finite(),
			label: z.string().trim().min(1).max(80),
			colorToken: chartColorTokenSchema.optional(),
		})
		.superRefine((value, context) => {
			if (value.from > value.to)
				context.addIssue({
					code: "custom",
					message: "from must be <= to",
					path: ["from"],
				});
		}),
	z.object({
		type: z.literal("null"),
		label: z.string().trim().min(1).max(80),
		colorToken: chartColorTokenSchema.optional(),
	}),
]);

export const referenceLineSchema = z.object({
	value: z.number().finite(),
	label: z.string().trim().max(64).optional(),
	colorToken: chartColorTokenSchema.optional(),
});

const linkValueSourceSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("field"), key: z.string().trim().min(1).max(64) }),
	z.object({ kind: z.literal("filter"), key: dashboardEntityIdSchema }),
	z.object({ kind: z.literal("constant"), value: z.string().max(256) }),
]);

export const panelLinkSchema = z
	.object({
		targetId: dashboardEntityIdSchema,
		to: z.string().startsWith("/").max(256),
		search: z
			.record(z.string().trim().min(1).max(64), linkValueSourceSchema)
			.default({}),
		includeRange: z.boolean().default(false),
		includeFilters: z.boolean().default(false),
	})
	.superRefine((value, context) => {
		if (
			value.to.startsWith("//") ||
			value.to.includes("\\") ||
			value.to.includes("://")
		) {
			context.addIssue({
				code: "custom",
				message: "link target must be a same-origin path",
				path: ["to"],
			});
		}
	});
export type PanelLink = z.infer<typeof panelLinkSchema>;

export const panelVisualizationSchema = z
	.object({
		type: z.enum(["line", "area", "bar", "stat", "table"]),
		unit: z.string().trim().max(32).default(""),
		decimalPlaces: z.number().int().min(0).max(8).default(2),
		showLegend: z.boolean().default(true),
		thresholds: z.array(thresholdSchema).max(10).default([]),
		valueMappings: z.array(valueMappingSchema).max(20).default([]),
		referenceLines: z.array(referenceLineSchema).max(10).default([]),
		fill: z.enum(["null", "zero", "previous"]).default("null"),
		connectNulls: z.boolean().default(false),
		yAxisScale: z.enum(["linear", "log"]).default("linear"),
		yAxisMin: z.union([z.literal("auto"), z.number().finite()]).default("auto"),
		yAxisMax: z.union([z.literal("auto"), z.number().finite()]).default("auto"),
		links: z.array(panelLinkSchema).max(10).default([]),
	})
	.superRefine((value, context) => {
		for (let index = 1; index < value.thresholds.length; index += 1) {
			if (
				(value.thresholds[index - 1]?.value ?? 0) >
				(value.thresholds[index]?.value ?? 0)
			) {
				context.addIssue({
					code: "custom",
					message: "thresholds must be sorted by value",
					path: ["thresholds", index],
				});
			}
		}
	});
export type PanelVisualization = z.infer<typeof panelVisualizationSchema>;

export const panelManifestSchema = z.object({
	id: dashboardPanelIdSchema,
	title: z.string().trim().min(1).max(128),
	description: z.string().trim().max(512).default(""),
	layout: panelLayoutSchema,
	queryId: dashboardEntityIdSchema,
	visualization: panelVisualizationSchema,
	accessibleLabel: z.string().trim().min(1).max(256),
});
export type PanelManifest = z.infer<typeof panelManifestSchema>;

export const dashboardManifestSchema = z.object({
	id: dashboardEntityIdSchema,
	title: z.string().trim().min(1).max(128),
	description: z.string().trim().max(512).default(""),
	layoutVersion: z.number().int().min(1),
	defaultRange: dashboardRangeSchema,
	defaultTimezone: dashboardTimezoneSchema,
	defaultRefreshSeconds: z.number().int().min(0).max(3600).default(0),
	variables: z
		.array(variableManifestSchema)
		.max(DASHBOARD_LIMITS.maxVariables)
		.default([]),
	panels: z.array(panelManifestSchema).min(1).max(DASHBOARD_LIMITS.maxPanels),
	inspectorEnabled: z.boolean().default(true),
});
export type DashboardManifest = z.infer<typeof dashboardManifestSchema>;

export const publicVariableManifestSchema = variableManifestSchema.extend({
	source: z.discriminatedUnion("kind", [
		z.object({ kind: z.literal("static") }),
		queryVariableSourceSchema,
	]),
});
export const publicDashboardManifestSchema = dashboardManifestSchema.extend({
	variables: z
		.array(publicVariableManifestSchema)
		.max(DASHBOARD_LIMITS.maxVariables),
});
export type PublicDashboardManifest = z.infer<
	typeof publicDashboardManifestSchema
>;

const numericValueSchema = z.number().finite();
export const timeSeriesRowSchema = z.object({
	time: z.number().int().safe(),
	values: z.record(
		z.string().trim().min(1).max(64),
		numericValueSchema.nullable(),
	),
});
export const timeSeriesDataSchema = z.object({
	kind: z.literal("timeseries"),
	series: z
		.array(seriesMetaSchema)
		.min(1)
		.max(DASHBOARD_LIMITS.absoluteMaxSeries),
	rows: z.array(timeSeriesRowSchema).max(DASHBOARD_LIMITS.maxDataPoints),
});

export const categoryDataSchema = z.object({
	kind: z.literal("category"),
	series: z
		.array(seriesMetaSchema)
		.min(1)
		.max(DASHBOARD_LIMITS.absoluteMaxSeries),
	rows: z
		.array(
			z.object({
				category: z.string().trim().min(1).max(128),
				values: z.record(
					z.string().trim().min(1).max(64),
					numericValueSchema.nullable(),
				),
			}),
		)
		.max(DASHBOARD_LIMITS.maxDataPoints),
});

export const statDataSchema = z.object({
	kind: z.literal("stat"),
	value: numericValueSchema.nullable(),
	previous: numericValueSchema.nullable().optional(),
	delta: numericValueSchema.nullable().optional(),
	series: seriesMetaSchema.optional(),
});

export const tableCellSchema = z.union([
	z.string(),
	numericValueSchema,
	z.boolean(),
	z.null(),
]);
export const tableDataSchema = z.object({
	kind: z.literal("table"),
	columns: z.array(tableColumnSchema).min(1).max(64),
	rows: z
		.array(z.record(z.string().trim().min(1).max(64), tableCellSchema))
		.max(DASHBOARD_LIMITS.maxTableRows),
});

export const panelDataStateSchema = z
	.object({
		emptyReason: z
			.enum(["no-records", "filter-no-match", "not-configured"])
			.optional(),
		partial: z.boolean().default(false),
		warnings: z.array(z.string().trim().min(1).max(256)).max(20).default([]),
		dataThrough: z.string().datetime({ offset: true }).optional(),
		staleAfterMs: z.number().int().positive().optional(),
	})
	.superRefine((value, context) => {
		if (value.partial && value.warnings.length === 0)
			context.addIssue({
				code: "custom",
				message: "partial data must include a warning",
				path: ["warnings"],
			});
	});
export type PanelDataState = z.infer<typeof panelDataStateSchema>;

export const panelDataSchema = z.discriminatedUnion("kind", [
	timeSeriesDataSchema,
	categoryDataSchema,
	statDataSchema,
	tableDataSchema,
]);
export type PanelData = z.infer<typeof panelDataSchema>;

export const panelQueryRequestSchema = z.object({
	range: dashboardRangeSchema,
	timezone: dashboardTimezoneSchema,
	filters: dashboardFiltersSchema.default({}),
	maxDataPoints: z
		.number()
		.int()
		.min(1)
		.max(DASHBOARD_LIMITS.maxDataPoints)
		.default(DASHBOARD_LIMITS.defaultMaxDataPoints),
});
export type PanelQueryRequest = z.infer<typeof panelQueryRequestSchema>;

export const variableOptionsRequestSchema = z.object({
	range: dashboardRangeSchema,
	timezone: dashboardTimezoneSchema,
	filters: dashboardFiltersSchema.default({}),
});
export type VariableOptionsRequest = z.infer<
	typeof variableOptionsRequestSchema
>;

export const panelQueryResponseSchema = z.object({
	requestId: z.string().uuid(),
	generatedAt: z.string().datetime({ offset: true }),
	resolvedRange: z.object({
		from: z.string().datetime({ offset: true }),
		to: z.string().datetime({ offset: true }),
	}),
	intervalMs: z.number().int().positive(),
	durationMs: z.number().int().min(0),
	rowCount: z.number().int().min(0),
	seriesCount: z.number().int().min(0),
	state: panelDataStateSchema,
	data: panelDataSchema,
});
export type PanelQueryResponse = z.infer<typeof panelQueryResponseSchema>;

export const dashboardErrorCodeSchema = z.enum([
	"INVALID_REQUEST",
	"DASHBOARD_NOT_FOUND",
	"PANEL_NOT_FOUND",
	"VARIABLE_NOT_FOUND",
	"VARIABLE_DEPENDENCY_INVALID",
	"HANDLER_TIMEOUT",
	"REQUEST_CANCELLED",
	"EXECUTION_LIMIT_REACHED",
	"SERIES_LIMIT_EXCEEDED",
	"ROW_LIMIT_EXCEEDED",
	"DUPLICATE_TIMESTAMP",
	"INVALID_HANDLER_RESULT",
	"QUERY_FAILED",
]);
export type DashboardErrorCode = z.infer<typeof dashboardErrorCodeSchema>;

export const dashboardErrorResponseSchema = z.object({
	error: z.object({
		code: dashboardErrorCodeSchema,
		message: z.string().trim().min(1).max(512),
		requestId: z.string().uuid(),
		retryable: z.boolean(),
		details: z.record(z.string(), z.unknown()).optional(),
	}),
});
export type DashboardErrorResponse = z.infer<
	typeof dashboardErrorResponseSchema
>;

export const variableOptionsResponseSchema = z.object({
	variableId: dashboardEntityIdSchema,
	options: z.array(variableOptionSchema).max(100),
});
export type VariableOptionsResponse = z.infer<
	typeof variableOptionsResponseSchema
>;
