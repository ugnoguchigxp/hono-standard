import { z } from "zod";
import {
	DASHBOARD_V2_LIMITS,
	dashboardFiltersV2Schema,
	dashboardFrameRefIdSchema,
	dashboardRangeV2Schema,
	dashboardTimezoneV2Schema,
} from "./common.schema";
import { dashboardDataFrameV2Schema } from "./data-frame.schema";
import {
	dashboardJsonObjectSchema,
	validateDashboardJsonValue,
} from "./json-value.schema";
import {
	dashboardManifestSchema,
	panelQueryRequestSchema,
	panelQueryResponseSchema,
	variableOptionsRequestSchema,
	variableOptionsResponseSchema,
	type DashboardManifest,
} from "./legacy-v1.schema";
import {
	dashboardManifestV2Schema,
	type DashboardManifestV2,
} from "./manifest-v2.schema";

export const panelQueryRequestV2Schema = z
	.object({
		schemaVersion: z.literal(2),
		range: dashboardRangeV2Schema,
		timezone: dashboardTimezoneV2Schema,
		filters: dashboardFiltersV2Schema.default({}),
		maxDataPoints: z.number().int().min(1).max(2000).default(800),
		maxRows: z.number().int().min(1).max(2000).default(2000),
	})
	.strict();
export type PanelQueryRequestV2 = z.infer<typeof panelQueryRequestV2Schema>;

export const dashboardNoticeV2Schema = z
	.object({
		severity: z.enum(["info", "warning"]),
		code: z
			.string()
			.regex(/^[A-Z][A-Z0-9_]*$/)
			.max(64),
		message: z.string().trim().min(1).max(512),
		frameRefId: dashboardFrameRefIdSchema.optional(),
		fieldKey: z
			.string()
			.regex(/^[A-Za-z_][A-Za-z0-9_.:-]*$/)
			.max(100)
			.optional(),
	})
	.strict();
export type DashboardNoticeV2 = z.infer<typeof dashboardNoticeV2Schema>;
export const panelDataStateV2Schema = z
	.object({
		emptyReason: z
			.enum(["no-records", "filter-no-match", "not-configured"])
			.optional(),
		partial: z.boolean().default(false),
		truncated: z.boolean().default(false),
		notices: z
			.array(dashboardNoticeV2Schema)
			.max(DASHBOARD_V2_LIMITS.maxNotices)
			.default([]),
		dataThrough: z.string().datetime({ offset: true }).optional(),
		staleAfterMs: z.number().int().positive().optional(),
	})
	.strict()
	.superRefine((state, context) => {
		if (
			state.partial &&
			!state.notices.some((notice) => notice.severity === "warning")
		)
			context.addIssue({
				code: "custom",
				path: ["notices"],
				message: "partial state requires a warning notice",
			});
		if (
			state.truncated &&
			!state.notices.some(
				(notice) =>
					notice.code === "DATA_TRUNCATED" && notice.severity === "warning",
			)
		)
			context.addIssue({
				code: "custom",
				path: ["notices"],
				message: "truncated state requires DATA_TRUNCATED warning",
			});
	});
export type PanelDataStateV2 = z.infer<typeof panelDataStateV2Schema>;
export const panelQueryCountsV2Schema = z
	.object({
		frames: z.number().int().min(0),
		fields: z.number().int().min(0),
		rows: z.number().int().min(0),
		cells: z.number().int().min(0),
	})
	.strict();
export type PanelQueryCountsV2 = z.infer<typeof panelQueryCountsV2Schema>;

const resolvedRangeSchema = z
	.object({
		from: z.string().datetime({ offset: true }),
		to: z.string().datetime({ offset: true }),
	})
	.strict()
	.superRefine((value, context) => {
		if (Date.parse(value.from) >= Date.parse(value.to))
			context.addIssue({
				code: "custom",
				path: ["from"],
				message: "from must be before to",
			});
	});
export const panelQueryResponseV2Schema = z
	.object({
		schemaVersion: z.literal(2),
		requestId: z.string().uuid(),
		generatedAt: z.string().datetime({ offset: true }),
		resolvedRange: resolvedRangeSchema,
		intervalMs: z.number().int().positive().optional(),
		durationMs: z.number().int().min(0),
		counts: panelQueryCountsV2Schema,
		state: panelDataStateV2Schema,
		frames: z
			.array(dashboardDataFrameV2Schema)
			.min(1)
			.max(DASHBOARD_V2_LIMITS.maxFramesPerResponse),
	})
	.strict()
	.superRefine((response, context) => {
		if (
			new Set(response.frames.map((frame) => frame.refId)).size !==
			response.frames.length
		)
			context.addIssue({
				code: "custom",
				path: ["frames"],
				message: "frame refIds must be unique",
			});
		const actual = response.frames.reduce(
			(counts, frame) => {
				const rows = frame.fields[0]?.values.length ?? 0;
				counts.fields += frame.fields.length;
				counts.rows += rows;
				counts.cells += rows * frame.fields.length;
				return counts;
			},
			{ frames: response.frames.length, fields: 0, rows: 0, cells: 0 },
		);
		if (JSON.stringify(actual) !== JSON.stringify(response.counts))
			context.addIssue({
				code: "custom",
				path: ["counts"],
				message: "counts must match frames",
			});
		if (actual.cells > DASHBOARD_V2_LIMITS.maxCellsPerResponse)
			context.addIssue({
				code: "custom",
				path: ["frames"],
				message: "response cell limit exceeded",
			});
		const hasRows = response.frames.some(
			(frame) => (frame.fields[0]?.values.length ?? 0) > 0,
		);
		if (!hasRows && !response.state.emptyReason)
			context.addIssue({
				code: "custom",
				path: ["state", "emptyReason"],
				message: "empty response requires emptyReason",
			});
		if (hasRows && response.state.emptyReason)
			context.addIssue({
				code: "custom",
				path: ["state", "emptyReason"],
				message: "emptyReason is only allowed when all frames are empty",
			});
	});
export type PanelQueryResponseV2 = z.infer<typeof panelQueryResponseV2Schema>;

export const variableOptionsRequestV2Schema = z
	.object({
		schemaVersion: z.literal(2),
		range: dashboardRangeV2Schema,
		timezone: dashboardTimezoneV2Schema,
		filters: dashboardFiltersV2Schema.default({}),
	})
	.strict();
export type VariableOptionsRequestV2 = z.infer<
	typeof variableOptionsRequestV2Schema
>;
export const variableOptionsResponseV2Schema = z
	.object({
		schemaVersion: z.literal(2),
		variableId: z
			.string()
			.regex(/^[a-z][a-z0-9-]*$/)
			.max(64),
		options: z
			.array(
				z
					.object({
						value: z.string().trim().min(1).max(128),
						label: z.string().trim().min(1).max(128),
						disabled: z.boolean().default(false),
					})
					.strict(),
			)
			.max(DASHBOARD_V2_LIMITS.maxVariableOptions),
	})
	.strict()
	.superRefine((response, context) => {
		if (
			new Set(response.options.map((option) => option.value)).size !==
			response.options.length
		)
			context.addIssue({
				code: "custom",
				path: ["options"],
				message: "option values must be unique",
			});
	});
export type VariableOptionsResponseV2 = z.infer<
	typeof variableOptionsResponseV2Schema
>;

export const dashboardErrorCodeV2Schema = z.enum([
	"INVALID_REQUEST",
	"DASHBOARD_NOT_FOUND",
	"PANEL_NOT_FOUND",
	"VARIABLE_NOT_FOUND",
	"VARIABLE_DEPENDENCY_INVALID",
	"HANDLER_TIMEOUT",
	"REQUEST_CANCELLED",
	"EXECUTION_LIMIT_REACHED",
	"QUERY_FAILED",
	"INVALID_HANDLER_RESULT",
	"SCHEMA_VERSION_UNSUPPORTED",
	"FRAME_LIMIT_EXCEEDED",
	"FIELD_LIMIT_EXCEEDED",
	"CELL_LIMIT_EXCEEDED",
	"VISUALIZATION_NOT_REGISTERED",
	"VISUALIZATION_CONFIG_INVALID",
	"INCOMPATIBLE_VISUALIZATION",
	"TRANSFORMATION_NOT_REGISTERED",
	"TRANSFORMATION_CONFIG_INVALID",
	"TRANSFORMATION_FAILED",
	"PANEL_TIMEOUT",
	"INVALID_DATA_FRAME",
	"INVALID_JSON_VALUE",
]);
export type DashboardErrorCodeV2 = z.infer<typeof dashboardErrorCodeV2Schema>;
export const dashboardErrorResponseV2Schema = z
	.object({
		error: z
			.object({
				code: dashboardErrorCodeV2Schema,
				message: z.string().trim().min(1).max(512),
				requestId: z.string().uuid(),
				retryable: z.boolean(),
				details: dashboardJsonObjectSchema.optional(),
			})
			.strict(),
	})
	.strict()
	.superRefine((value, context) => {
		const details = value.error.details;
		if (
			details &&
			!validateDashboardJsonValue(details, {
				maxDepth: 8,
				maxObjectKeys: 128,
				maxArrayItems: 2000,
				maxBytes: DASHBOARD_V2_LIMITS.maxErrorDetailsBytes,
			}).valid
		)
			context.addIssue({
				code: "custom",
				path: ["error", "details"],
				message: "error details exceed JSON budget",
			});
	});
export type DashboardErrorResponseV2 = z.infer<
	typeof dashboardErrorResponseV2Schema
>;

export function detectDashboardPayloadVersion(value: unknown): 1 | 2 {
	if (
		value !== null &&
		typeof value === "object" &&
		!Array.isArray(value) &&
		"schemaVersion" in value
	) {
		const version = (value as { schemaVersion?: unknown }).schemaVersion;
		if (version === 2) return 2;
		if (version === 1) return 1;
		throw new Error("SCHEMA_VERSION_UNSUPPORTED");
	}
	return 1;
}

export type VersionedPayload<TV1, TV2> =
	| { version: 1; value: TV1 }
	| { version: 2; value: TV2 };
export const dashboardManifestAnyVersionSchema = z.union([
	dashboardManifestV2Schema.transform((value) => ({
		version: 2 as const,
		value,
	})),
	dashboardManifestSchema.transform((value) => ({
		version: 1 as const,
		value,
	})),
]);
export const panelQueryRequestAnyVersionSchema = z.union([
	panelQueryRequestV2Schema.transform((value) => ({
		version: 2 as const,
		value,
	})),
	panelQueryRequestSchema.transform((value) => ({
		version: 1 as const,
		value,
	})),
]);
export const panelQueryResponseAnyVersionSchema = z.union([
	panelQueryResponseV2Schema.transform((value) => ({
		version: 2 as const,
		value,
	})),
	panelQueryResponseSchema.transform((value) => ({
		version: 1 as const,
		value,
	})),
]);
export const variableOptionsRequestAnyVersionSchema = z.union([
	variableOptionsRequestV2Schema.transform((value) => ({
		version: 2 as const,
		value,
	})),
	variableOptionsRequestSchema.transform((value) => ({
		version: 1 as const,
		value,
	})),
]);
export const variableOptionsResponseAnyVersionSchema = z.union([
	variableOptionsResponseV2Schema.transform((value) => ({
		version: 2 as const,
		value,
	})),
	variableOptionsResponseSchema.transform((value) => ({
		version: 1 as const,
		value,
	})),
]);
export type DashboardManifestAnyVersion = VersionedPayload<
	DashboardManifest,
	DashboardManifestV2
>;
