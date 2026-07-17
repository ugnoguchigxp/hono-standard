import { z } from "zod";
import {
	DASHBOARD_V2_LIMITS,
	dashboardFieldKeySchema,
	dashboardFrameRefIdSchema,
	dashboardIdSchema,
	dashboardTransformationInstanceIdSchema,
	dashboardVariableIdSchema,
} from "./common.schema";

export const dashboardColorTokenSchema = z
	.string()
	.regex(/^--[a-z0-9]+(?:-[a-z0-9]+)*$/)
	.max(80);

export const fieldUnitV2Schema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("none") }).strict(),
	z.object({ kind: z.literal("short") }).strict(),
	z
		.object({ kind: z.literal("percent"), scale: z.enum(["unit", "hundred"]) })
		.strict(),
	z
		.object({
			kind: z.literal("bytes"),
			base: z.union([z.literal(1000), z.literal(1024)]),
		})
		.strict(),
	z
		.object({
			kind: z.literal("duration"),
			unit: z.enum(["ns", "us", "ms", "s", "m", "h", "d"]),
		})
		.strict(),
	z.object({ kind: z.literal("rate"), suffix: z.string().max(16) }).strict(),
	z
		.object({
			kind: z.literal("currency"),
			code: z.string().regex(/^[A-Z]{3}$/),
		})
		.strict(),
	z.object({ kind: z.literal("custom"), suffix: z.string().max(16) }).strict(),
]);
export type FieldUnitV2 = z.infer<typeof fieldUnitV2Schema>;

const thresholdStepSchema = z
	.object({
		value: z.union([z.number().finite(), z.null()]),
		colorToken: dashboardColorTokenSchema,
		label: z.string().trim().max(80).optional(),
	})
	.strict();
export const thresholdConfigV2Schema = z
	.object({
		mode: z.enum(["absolute", "percentage"]),
		steps: z
			.array(thresholdStepSchema)
			.min(1)
			.max(DASHBOARD_V2_LIMITS.maxThresholdSteps),
	})
	.strict()
	.superRefine((value, context) => {
		if (value.steps[0]?.value !== null)
			context.addIssue({
				code: "custom",
				path: ["steps", 0, "value"],
				message: "only the first threshold step may be null",
			});
		let previous: number | null = null;
		for (let index = 0; index < value.steps.length; index += 1) {
			const step = value.steps[index];
			if (!step || step.value === null) continue;
			if (value.mode === "percentage" && (step.value < 0 || step.value > 100))
				context.addIssue({
					code: "custom",
					path: ["steps", index, "value"],
					message: "percentage threshold must be between 0 and 100",
				});
			if (previous !== null && step.value <= previous)
				context.addIssue({
					code: "custom",
					path: ["steps", index, "value"],
					message: "threshold steps must be strictly increasing",
				});
			previous = step.value;
		}
	});
export type ThresholdConfigV2 = z.infer<typeof thresholdConfigV2Schema>;

export const valueMappingV2Schema = z.discriminatedUnion("kind", [
	z
		.object({
			kind: z.literal("value"),
			value: z.union([z.string(), z.number().finite(), z.boolean()]),
			text: z.string().trim().min(1).max(80),
			colorToken: dashboardColorTokenSchema.optional(),
		})
		.strict(),
	z
		.object({
			kind: z.literal("range"),
			from: z.number().finite(),
			to: z.number().finite(),
			text: z.string().trim().min(1).max(80),
			colorToken: dashboardColorTokenSchema.optional(),
		})
		.strict()
		.refine((value) => value.from <= value.to, {
			path: ["from"],
			message: "from must be <= to",
		}),
	z
		.object({
			kind: z.literal("null"),
			text: z.string().trim().min(1).max(80),
			colorToken: dashboardColorTokenSchema.optional(),
		})
		.strict(),
]);
export type ValueMappingV2 = z.infer<typeof valueMappingV2Schema>;

const fieldColorSchema = z.union([
	z
		.object({ mode: z.literal("fixed"), token: dashboardColorTokenSchema })
		.strict(),
	z
		.object({
			mode: z.literal("palette"),
			palette: z.enum(["categorical", "sequential", "diverging", "status"]),
		})
		.strict(),
]);

export const standardFieldConfigV2Schema = z
	.object({
		displayName: z.string().trim().max(128).optional(),
		description: z.string().trim().max(512).optional(),
		unit: fieldUnitV2Schema.default({ kind: "none" }),
		decimals: z
			.union([z.literal("auto"), z.number().int().min(0).max(8)])
			.default("auto"),
		min: z.number().finite().optional(),
		max: z.number().finite().optional(),
		noValueText: z.string().max(32).default("—"),
		textAlign: z.enum(["auto", "left", "center", "right"]).default("auto"),
		color: fieldColorSchema.optional(),
		thresholds: thresholdConfigV2Schema.optional(),
		valueMappings: z
			.array(valueMappingV2Schema)
			.max(DASHBOARD_V2_LIMITS.maxValueMappings)
			.default([]),
		links: z
			.array(z.lazy(() => panelLinkV2Schema))
			.max(DASHBOARD_V2_LIMITS.maxLinksPerPanel)
			.default([]),
	})
	.strict()
	.superRefine((value, context) => {
		if (
			value.min !== undefined &&
			value.max !== undefined &&
			value.min >= value.max
		)
			context.addIssue({
				code: "custom",
				path: ["min"],
				message: "min must be less than max",
			});
		if (
			value.thresholds?.mode === "percentage" &&
			(value.min === undefined ||
				value.max === undefined ||
				value.min >= value.max)
		)
			context.addIssue({
				code: "custom",
				path: ["thresholds"],
				message: "percentage thresholds require finite min and max",
			});
	});
export type StandardFieldConfigV2 = z.infer<typeof standardFieldConfigV2Schema>;
export const standardFieldConfigPatchV2Schema = z
	.object({
		displayName: z.string().trim().max(128).optional(),
		description: z.string().trim().max(512).optional(),
		unit: fieldUnitV2Schema.optional(),
		decimals: z
			.union([z.literal("auto"), z.number().int().min(0).max(8)])
			.optional(),
		min: z.number().finite().optional(),
		max: z.number().finite().optional(),
		noValueText: z.string().max(32).optional(),
		textAlign: z.enum(["auto", "left", "center", "right"]).optional(),
		color: fieldColorSchema.optional(),
		thresholds: thresholdConfigV2Schema.optional(),
		valueMappings: z
			.array(valueMappingV2Schema)
			.max(DASHBOARD_V2_LIMITS.maxValueMappings)
			.optional(),
		links: z
			.array(z.lazy(() => panelLinkV2Schema))
			.max(DASHBOARD_V2_LIMITS.maxLinksPerPanel)
			.optional(),
	})
	.strict()
	.superRefine((value, context) => {
		if (
			value.min !== undefined &&
			value.max !== undefined &&
			value.min >= value.max
		)
			context.addIssue({
				code: "custom",
				path: ["min"],
				message: "min must be less than max",
			});
	});
export type StandardFieldConfigPatchV2 = z.infer<
	typeof standardFieldConfigPatchV2Schema
>;

export const dashboardFieldTypeSchema = z.enum([
	"time",
	"number",
	"string",
	"boolean",
]);
export type DashboardFieldType = z.infer<typeof dashboardFieldTypeSchema>;
export const dashboardFieldRoleSchema = z.enum([
	"time",
	"value",
	"category",
	"series",
	"x",
	"y",
	"lower",
	"upper",
	"min",
	"max",
	"q1",
	"median",
	"q3",
	"size",
	"bin-start",
	"bin-end",
	"count",
	"state",
	"start-time",
	"end-time",
	"id",
	"parent-id",
	"source",
	"target",
	"latitude",
	"longitude",
	"level",
	"severity",
	"message",
	"url",
	"trace-id",
	"span-id",
	"parent-span-id",
	"duration",
	"open",
	"high",
	"low",
	"close",
	"volume",
	"self",
	"total",
	"previous",
	"delta",
	"goal",
	"label",
	"service",
	"operation",
	"baseline",
	"region-id",
	"source-latitude",
	"source-longitude",
	"target-latitude",
	"target-longitude",
]);
export type DashboardFieldRole = z.infer<typeof dashboardFieldRoleSchema>;

const matcherSchema = z.discriminatedUnion("kind", [
	z
		.object({
			kind: z.literal("field-name"),
			fieldKey: dashboardFieldKeySchema,
		})
		.strict(),
	z
		.object({
			kind: z.literal("field-type"),
			fieldType: dashboardFieldTypeSchema,
		})
		.strict(),
	z
		.object({ kind: z.literal("field-role"), role: dashboardFieldRoleSchema })
		.strict(),
	z
		.object({
			kind: z.literal("field-regex"),
			pattern: z.string().max(128),
			flags: z.literal("i").or(z.literal("")),
		})
		.strict(),
	z
		.object({ kind: z.literal("frame-ref"), refId: dashboardFrameRefIdSchema })
		.strict(),
	z
		.object({ kind: z.literal("query-ref"), refId: dashboardFrameRefIdSchema })
		.strict(),
	z
		.object({
			kind: z.literal("transformation-ref"),
			id: dashboardTransformationInstanceIdSchema,
		})
		.strict(),
]);
export const fieldMatcherV2Schema = matcherSchema.superRefine(
	(value, context) => {
		if (value.kind !== "field-regex") return;
		if (/\\[1-9]|\\k<|\(\?<=[^)]*\)|\(\?<!/.test(value.pattern))
			context.addIssue({
				code: "custom",
				path: ["pattern"],
				message: "regex backreferences and lookbehind are not allowed",
			});
		try {
			new RegExp(value.pattern, value.flags);
		} catch {
			context.addIssue({
				code: "custom",
				path: ["pattern"],
				message: "invalid regex",
			});
		}
	},
);
export type FieldMatcherV2 = z.infer<typeof fieldMatcherV2Schema>;

export const fieldOverrideV2Schema = z
	.object({
		id: dashboardIdSchema,
		matcher: fieldMatcherV2Schema,
		properties: standardFieldConfigPatchV2Schema.refine(
			(value) => Object.keys(value).length > 0,
			"override properties must not be empty",
		),
	})
	.strict();
export type FieldOverrideV2 = z.infer<typeof fieldOverrideV2Schema>;

const linkValueSourceV2Schema = z.discriminatedUnion("kind", [
	z
		.object({ kind: z.literal("field"), fieldKey: dashboardFieldKeySchema })
		.strict(),
	z
		.object({
			kind: z.literal("filter"),
			variableId: dashboardVariableIdSchema,
			format: z.enum(["first", "comma", "json"]),
		})
		.strict(),
	z
		.object({
			kind: z.literal("constant"),
			value: z.union([z.string(), z.number().finite(), z.boolean()]),
		})
		.strict(),
	z.object({ kind: z.literal("dashboard-range-from") }).strict(),
	z.object({ kind: z.literal("dashboard-range-to") }).strict(),
	z.object({ kind: z.literal("frame-ref") }).strict(),
]);
export const panelLinkV2Schema = z
	.object({
		id: dashboardIdSchema,
		title: z.string().trim().min(1).max(80),
		targetId: dashboardIdSchema,
		to: z.string().startsWith("/").max(256),
		search: z
			.record(z.string().trim().min(1).max(64), linkValueSourceV2Schema)
			.default({}),
		includeRange: z.boolean().default(false),
		includeFilters: z.boolean().default(false),
		openInNewTab: z.boolean().default(false),
	})
	.strict()
	.superRefine((value, context) => {
		if (
			value.to.startsWith("//") ||
			value.to.includes("\\") ||
			value.to.includes("://")
		)
			context.addIssue({
				code: "custom",
				path: ["to"],
				message: "link target must be a same-origin path",
			});
	});
export type PanelLinkV2 = z.infer<typeof panelLinkV2Schema>;

export const standardFieldConfigDefaultsV2: StandardFieldConfigV2 =
	standardFieldConfigV2Schema.parse({});
