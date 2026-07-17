import { z } from "zod";
import {
	DASHBOARD_V2_LIMITS,
	dashboardFieldKeySchema,
	dashboardFrameRefIdSchema,
	dashboardTransformationInstanceIdSchema,
} from "./common.schema";
import { dashboardJsonObjectSchema } from "./json-value.schema";
import {
	dashboardFieldRoleSchema,
	type DashboardFieldRole,
	type DashboardFieldType,
	standardFieldConfigPatchV2Schema,
} from "./field-config.schema";

export const dashboardDataShapeSchema = z.enum([
	"scalar",
	"timeseries",
	"category",
	"table",
	"distribution",
	"matrix",
	"state-interval",
	"state-sample",
	"annotation",
	"hierarchy",
	"graph-nodes",
	"graph-edges",
	"logs",
	"traces",
	"profile",
	"geo",
	"ohlc",
]);
export type DashboardDataShape = z.infer<typeof dashboardDataShapeSchema>;
export const dashboardFrameSourceV2Schema = z.discriminatedUnion("kind", [
	z
		.object({ kind: z.literal("query"), refId: dashboardFrameRefIdSchema })
		.strict(),
	z
		.object({
			kind: z.literal("transformation"),
			id: dashboardTransformationInstanceIdSchema,
		})
		.strict(),
]);
export type DashboardFrameSourceV2 = z.infer<
	typeof dashboardFrameSourceV2Schema
>;

const fieldBase = {
	key: dashboardFieldKeySchema,
	label: z.string().trim().min(1).max(DASHBOARD_V2_LIMITS.maxLabelLength),
	roles: z
		.array(dashboardFieldRoleSchema)
		.max(DASHBOARD_V2_LIMITS.maxFieldRoles)
		.default([]),
	labels: z
		.record(
			dashboardFieldKeySchema,
			z.string().max(DASHBOARD_V2_LIMITS.maxLabelLength),
		)
		.refine(
			(value) =>
				Object.keys(value).length <= DASHBOARD_V2_LIMITS.maxFieldLabels,
			"too many field labels",
		)
		.default({}),
	config: standardFieldConfigPatchV2Schema.optional(),
};
const values = {
	time: z
		.array(z.number().int().safe().nullable())
		.max(DASHBOARD_V2_LIMITS.maxRowsPerFrame),
	number: z
		.array(z.number().finite().nullable())
		.max(DASHBOARD_V2_LIMITS.maxRowsPerFrame),
	string: z
		.array(z.string().max(DASHBOARD_V2_LIMITS.maxCellStringLength).nullable())
		.max(DASHBOARD_V2_LIMITS.maxRowsPerFrame),
	boolean: z
		.array(z.boolean().nullable())
		.max(DASHBOARD_V2_LIMITS.maxRowsPerFrame),
};

const fieldSchemas = [
	z
		.object({ ...fieldBase, type: z.literal("time"), values: values.time })
		.strict(),
	z
		.object({ ...fieldBase, type: z.literal("number"), values: values.number })
		.strict(),
	z
		.object({ ...fieldBase, type: z.literal("string"), values: values.string })
		.strict(),
	z
		.object({
			...fieldBase,
			type: z.literal("boolean"),
			values: values.boolean,
		})
		.strict(),
] as const;
export const dashboardFieldV2Schema = z
	.discriminatedUnion("type", fieldSchemas)
	.superRefine((field, context) => {
		if (new Set(field.roles).size !== field.roles.length)
			context.addIssue({
				code: "custom",
				path: ["roles"],
				message: "field roles must be unique",
			});
		for (const role of field.roles)
			if (!roleTypes[role].includes(field.type))
				context.addIssue({
					code: "custom",
					path: ["roles"],
					message: `role ${role} is incompatible with ${field.type}`,
				});
	});
export type DashboardFieldV2 = z.infer<typeof dashboardFieldV2Schema>;
export type { DashboardFieldType };

export const dashboardDataFrameV2Schema = z
	.object({
		schemaVersion: z.literal(2),
		refId: dashboardFrameRefIdSchema,
		source: dashboardFrameSourceV2Schema,
		name: z.string().trim().min(1).max(128),
		fields: z
			.array(dashboardFieldV2Schema)
			.min(1)
			.max(DASHBOARD_V2_LIMITS.maxFieldsPerFrame),
		meta: z
			.object({
				shapeHint: dashboardDataShapeSchema.optional(),
				queryId: z.string().trim().min(1).max(64).optional(),
				custom: dashboardJsonObjectSchema.optional(),
			})
			.strict()
			.default({}),
	})
	.strict()
	.superRefine((frame, context) => {
		const keys = new Set<string>();
		let rows: number | undefined;
		for (const [index, field] of frame.fields.entries()) {
			if (keys.has(field.key))
				context.addIssue({
					code: "custom",
					path: ["fields", index, "key"],
					message: "field keys must be unique",
				});
			keys.add(field.key);
			if (new Set(field.roles).size !== field.roles.length)
				context.addIssue({
					code: "custom",
					path: ["fields", index, "roles"],
					message: "field roles must be unique",
				});
			for (const role of field.roles)
				if (!roleTypes[role].includes(field.type))
					context.addIssue({
						code: "custom",
						path: ["fields", index, "roles"],
						message: `role ${role} is incompatible with ${field.type}`,
					});
			if (rows === undefined) rows = field.values.length;
			else if (rows !== field.values.length)
				context.addIssue({
					code: "custom",
					path: ["fields", index, "values"],
					message: "all fields must have the same row count",
				});
		}
		if (
			(rows ?? 0) * frame.fields.length >
			DASHBOARD_V2_LIMITS.maxCellsPerFrame
		)
			context.addIssue({
				code: "custom",
				path: ["fields"],
				message: "frame cell limit exceeded",
			});
	});
export type DashboardDataFrameV2 = z.infer<typeof dashboardDataFrameV2Schema>;

const roleTypes: Record<DashboardFieldRole, Array<DashboardFieldV2["type"]>> = {
	time: ["time"],
	"start-time": ["time"],
	"end-time": ["time"],
	value: ["number"],
	duration: ["number"],
	lower: ["number"],
	upper: ["number"],
	min: ["number"],
	max: ["number"],
	q1: ["number"],
	median: ["number"],
	q3: ["number"],
	size: ["number"],
	"bin-start": ["number"],
	"bin-end": ["number"],
	count: ["number"],
	latitude: ["number"],
	longitude: ["number"],
	level: ["number"],
	open: ["number"],
	high: ["number"],
	low: ["number"],
	close: ["number"],
	volume: ["number"],
	self: ["number"],
	total: ["number"],
	previous: ["number"],
	delta: ["number"],
	goal: ["number"],
	x: ["time", "number", "string"],
	y: ["time", "number", "string"],
	state: ["string", "number", "boolean"],
	id: ["string"],
	"parent-id": ["string"],
	source: ["string"],
	target: ["string"],
	"trace-id": ["string"],
	"span-id": ["string"],
	"parent-span-id": ["string"],
	severity: ["string"],
	message: ["string"],
	url: ["string"],
	category: ["string"],
	series: ["string"],
	label: ["string"],
	service: ["string"],
	operation: ["string"],
	baseline: ["number"],
	"region-id": ["string"],
	"source-latitude": ["number"],
	"source-longitude": ["number"],
	"target-latitude": ["number"],
	"target-longitude": ["number"],
};

const hasTypeRole = (frame: DashboardDataFrameV2, role: DashboardFieldRole) =>
	frame.fields.some(
		(field) =>
			field.roles.includes(role) && roleTypes[role].includes(field.type),
	);
const fiveNumber = (frame: DashboardDataFrameV2) =>
	["min", "q1", "median", "q3", "max"].every((role) =>
		hasTypeRole(frame, role as DashboardFieldRole),
	);

export type DashboardDataFrameShapeValidationResult =
	| { valid: true; shape: DashboardDataShape }
	| {
			valid: false;
			shape: DashboardDataShape;
			issues: Array<{ code: string; message: string; fieldKey?: string }>;
	  };
export function validateDashboardDataFrameShape(
	frame: DashboardDataFrameV2,
): DashboardDataFrameShapeValidationResult {
	const shape = frame.meta.shapeHint ?? "table";
	if (
		frame.fields.length === 0 ||
		frame.fields.every((field) => field.values.length === 0)
	)
		return { valid: true, shape };
	const valid = (() => {
		switch (shape) {
			case "scalar":
				return frame.fields.some((field) =>
					["number", "string", "boolean"].includes(field.type),
				);
			case "timeseries":
				return (
					hasTypeRole(frame, "time") &&
					(hasTypeRole(frame, "value") ||
						(hasTypeRole(frame, "lower") && hasTypeRole(frame, "upper")))
				);
			case "category":
				return (
					hasTypeRole(frame, "category") &&
					(hasTypeRole(frame, "value") || fiveNumber(frame))
				);
			case "table":
				return frame.fields.length > 0;
			case "distribution":
				return (
					(hasTypeRole(frame, "x") && hasTypeRole(frame, "y")) ||
					hasTypeRole(frame, "value") ||
					(hasTypeRole(frame, "bin-start") &&
						hasTypeRole(frame, "bin-end") &&
						hasTypeRole(frame, "count")) ||
					fiveNumber(frame)
				);
			case "matrix":
				return (
					hasTypeRole(frame, "x") &&
					hasTypeRole(frame, "y") &&
					(hasTypeRole(frame, "value") || hasTypeRole(frame, "count"))
				);
			case "state-interval":
				return hasTypeRole(frame, "start-time") && hasTypeRole(frame, "state");
			case "state-sample":
				return hasTypeRole(frame, "time") && hasTypeRole(frame, "state");
			case "annotation":
				return (
					hasTypeRole(frame, "message") &&
					((hasTypeRole(frame, "time") &&
						!hasTypeRole(frame, "start-time") &&
						!hasTypeRole(frame, "end-time")) ||
						(!hasTypeRole(frame, "time") &&
							hasTypeRole(frame, "start-time") &&
							hasTypeRole(frame, "end-time")))
				);
			case "hierarchy":
				return hasTypeRole(frame, "id") && hasTypeRole(frame, "value");
			case "graph-nodes":
				return hasTypeRole(frame, "id");
			case "graph-edges":
				return hasTypeRole(frame, "source") && hasTypeRole(frame, "target");
			case "logs":
				return hasTypeRole(frame, "time") && hasTypeRole(frame, "message");
			case "traces":
				return (
					hasTypeRole(frame, "trace-id") &&
					hasTypeRole(frame, "span-id") &&
					hasTypeRole(frame, "operation") &&
					hasTypeRole(frame, "service") &&
					hasTypeRole(frame, "start-time") &&
					hasTypeRole(frame, "duration")
				);
			case "profile":
				return (
					hasTypeRole(frame, "id") &&
					hasTypeRole(frame, "label") &&
					hasTypeRole(frame, "total")
				);
			case "geo":
				return (
					(hasTypeRole(frame, "latitude") && hasTypeRole(frame, "longitude")) ||
					(hasTypeRole(frame, "source-latitude") &&
						hasTypeRole(frame, "source-longitude") &&
						hasTypeRole(frame, "target-latitude") &&
						hasTypeRole(frame, "target-longitude")) ||
					(hasTypeRole(frame, "region-id") && hasTypeRole(frame, "value"))
				);
			case "ohlc":
				return (
					hasTypeRole(frame, "time") &&
					["open", "high", "low", "close"].every((role) =>
						hasTypeRole(frame, role as DashboardFieldRole),
					)
				);
		}
	})();
	if (shape === "annotation") {
		const rows = frame.fields[0]?.values.length ?? 0;
		if (rows > DASHBOARD_V2_LIMITS.maxAnnotations)
			return {
				valid: false,
				shape,
				issues: [
					{
						code: "ANNOTATION_LIMIT",
						message: "annotation frame limit exceeded",
					},
				],
			};
		const message = frame.fields.find((field) =>
			field.roles.includes("message"),
		);
		if (
			message?.values.some(
				(value) =>
					typeof value !== "string" ||
					value.trim().length === 0 ||
					value.length > 512,
			)
		)
			return {
				valid: false,
				shape,
				issues: [
					{
						code: "ANNOTATION_MESSAGE_INVALID",
						message: "annotation message must contain 1 to 512 characters",
					},
				],
			};
		const time = frame.fields.find((field) => field.roles.includes("time"));
		if (time?.values.some((value) => value === null))
			return {
				valid: false,
				shape,
				issues: [
					{
						code: "ANNOTATION_TIME_INVALID",
						message: "annotation event time is required",
					},
				],
			};
		const start = frame.fields.find((field) =>
			field.roles.includes("start-time"),
		);
		const end = frame.fields.find((field) => field.roles.includes("end-time"));
		if (
			start &&
			end &&
			start.values.some((value, index) => {
				const endValue = end.values[index];
				return (
					value === null ||
					endValue === null ||
					endValue === undefined ||
					value >= endValue
				);
			})
		)
			return {
				valid: false,
				shape,
				issues: [
					{
						code: "ANNOTATION_REGION_INVALID",
						message: "annotation region start must be before end",
					},
				],
			};
		const id = frame.fields.find((field) => field.roles.includes("id"));
		const ids =
			id?.values
				.filter((value): value is string => value !== null)
				.map(String) ?? [];
		if (new Set(ids).size !== ids.length)
			return {
				valid: false,
				shape,
				issues: [
					{
						code: "ANNOTATION_DUPLICATE_ID",
						message: "annotation IDs must be unique",
					},
				],
			};
	}
	if (valid) return { valid: true, shape };
	return {
		valid: false,
		shape,
		issues: [
			{
				code: "FRAME_SHAPE_INVALID",
				message: `frame does not satisfy ${shape} shape requirements`,
			},
		],
	};
}

type ManifestContext = {
	queries: Array<{ refId: string }>;
	transformations: Array<{
		id: string;
		disabled: boolean;
		outputFrameRefId: string;
	}>;
};
export function validatePanelFramesAgainstManifest(
	panel: ManifestContext,
	frames: DashboardDataFrameV2[],
) {
	const issues: Array<{
		code:
			| "UNKNOWN_QUERY_REF"
			| "UNKNOWN_TRANSFORMATION_REF"
			| "DUPLICATE_FRAME_REF"
			| "FRAME_SHAPE_INVALID";
		message: string;
		frameRefId?: string;
		sourceId?: string;
	}> = [];
	const queryRefs = new Set(panel.queries.map((query) => query.refId));
	const transformations = new Map(
		panel.transformations.map((transformation) => [
			transformation.id,
			transformation,
		]),
	);
	const frameRefs = new Set<string>();
	for (const frame of frames) {
		if (frameRefs.has(frame.refId))
			issues.push({
				code: "DUPLICATE_FRAME_REF",
				message: "duplicate frame refId",
				frameRefId: frame.refId,
			});
		frameRefs.add(frame.refId);
		if (frame.source.kind === "query" && !queryRefs.has(frame.source.refId))
			issues.push({
				code: "UNKNOWN_QUERY_REF",
				message: "unknown query refId",
				frameRefId: frame.refId,
				sourceId: frame.source.refId,
			});
		if (
			frame.source.kind === "transformation" &&
			(!transformations.has(frame.source.id) ||
				transformations.get(frame.source.id)?.disabled)
		)
			issues.push({
				code: "UNKNOWN_TRANSFORMATION_REF",
				message: "unknown or disabled transformation",
				frameRefId: frame.refId,
				sourceId: frame.source.id,
			});
		const shape = validateDashboardDataFrameShape(frame);
		if (!shape.valid)
			issues.push({
				code: "FRAME_SHAPE_INVALID",
				message: shape.issues[0]?.message ?? "invalid frame shape",
				frameRefId: frame.refId,
			});
	}
	return { valid: issues.length === 0, issues };
}
