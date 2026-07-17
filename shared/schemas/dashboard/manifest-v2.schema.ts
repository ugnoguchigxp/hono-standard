import { z } from "zod";
import {
	DASHBOARD_V2_LIMITS,
	dashboardIdSchema,
	dashboardPanelIdSchemaV2,
	dashboardQueryIdSchema,
	dashboardVariableIdSchema,
	dashboardFrameRefIdSchema,
	dashboardRangeV2Schema,
	dashboardTimezoneV2Schema,
} from "./common.schema";
import { panelLinkV2Schema } from "./field-config.schema";
import { transformationSpecV2Schema } from "./transformation.schema";
import { visualizationSpecV2Schema } from "./visualization.schema";

export const variableOptionV2Schema = z
	.object({
		value: z.string().trim().min(1).max(128),
		label: z.string().trim().min(1).max(128),
		disabled: z.boolean().default(false),
	})
	.strict();
export type VariableOptionV2 = z.infer<typeof variableOptionV2Schema>;
const staticSource = z
	.object({
		kind: z.literal("static"),
		options: z
			.array(variableOptionV2Schema)
			.min(1)
			.max(DASHBOARD_V2_LIMITS.maxStaticVariableOptions),
	})
	.strict();
const querySource = z
	.object({ kind: z.literal("query"), queryId: dashboardQueryIdSchema })
	.strict();
export const variableManifestV2Schema = z
	.object({
		id: dashboardVariableIdSchema,
		label: z.string().trim().min(1).max(128),
		description: z.string().trim().max(512).optional(),
		selection: z.enum(["single", "multiple"]),
		required: z.boolean().default(false),
		defaultValues: z
			.array(z.string().trim().min(1).max(128))
			.max(50)
			.default([]),
		dependsOn: z.array(dashboardVariableIdSchema).max(20).default([]),
		source: z.discriminatedUnion("kind", [staticSource, querySource]),
	})
	.strict()
	.superRefine((value, context) => {
		if (new Set(value.defaultValues).size !== value.defaultValues.length)
			context.addIssue({
				code: "custom",
				path: ["defaultValues"],
				message: "default values must be unique",
			});
		if (value.selection === "single" && value.defaultValues.length > 1)
			context.addIssue({
				code: "custom",
				path: ["defaultValues"],
				message: "single variable accepts at most one default",
			});
		if (value.required && value.defaultValues.length === 0)
			context.addIssue({
				code: "custom",
				path: ["defaultValues"],
				message: "required variable needs a default",
			});
		if (value.source.kind === "static") {
			const options = value.source.options;
			if (
				new Set(options.map((option) => option.value)).size !== options.length
			)
				context.addIssue({
					code: "custom",
					path: ["source", "options"],
					message: "option values must be unique",
				});
			const available = new Set(options.map((option) => option.value));
			for (const defaultValue of value.defaultValues)
				if (!available.has(defaultValue))
					context.addIssue({
						code: "custom",
						path: ["defaultValues"],
						message: "static default must exist in options",
					});
		}
	});
export type VariableManifestV2 = z.infer<typeof variableManifestV2Schema>;

export const panelQueryBindingV2Schema = z
	.object({
		refId: dashboardFrameRefIdSchema,
		queryId: dashboardQueryIdSchema,
		outputFrameRefs: z
			.array(dashboardFrameRefIdSchema)
			.min(1)
			.max(4)
			.refine(
				(values) => new Set(values).size === values.length,
				"outputFrameRefs must be unique",
			),
		hidden: z.boolean().default(false),
	})
	.strict();
export type PanelQueryBindingV2 = z.infer<typeof panelQueryBindingV2Schema>;
export const panelLayoutV2Schema = z
	.object({
		x: z.number().int().min(0),
		y: z.number().int().min(0),
		w: z.number().int().min(1).max(12),
		h: z.number().int().min(1).max(24),
		minW: z.number().int().min(1).max(12).default(1),
		minH: z.number().int().min(1).max(24).default(1),
		maxW: z.number().int().min(1).max(12).optional(),
		maxH: z.number().int().min(1).max(24).optional(),
	})
	.strict()
	.superRefine((value, context) => {
		if (value.x + value.w > 12)
			context.addIssue({
				code: "custom",
				path: ["w"],
				message: "panel must fit within 12 columns",
			});
		if (value.minW > value.w)
			context.addIssue({
				code: "custom",
				path: ["minW"],
				message: "minW must not exceed w",
			});
		if (value.maxW !== undefined && (value.w > value.maxW || value.maxW > 12))
			context.addIssue({
				code: "custom",
				path: ["maxW"],
				message: "invalid maxW",
			});
		if (value.minH > value.h)
			context.addIssue({
				code: "custom",
				path: ["minH"],
				message: "minH must not exceed h",
			});
		if (value.maxH !== undefined && (value.h > value.maxH || value.maxH > 24))
			context.addIssue({
				code: "custom",
				path: ["maxH"],
				message: "invalid maxH",
			});
	});
export type PanelLayoutV2 = z.infer<typeof panelLayoutV2Schema>;

export const panelManifestV2Schema = z
	.object({
		id: dashboardPanelIdSchemaV2,
		title: z.string().trim().min(1).max(128),
		description: z.string().trim().max(512).default(""),
		layout: panelLayoutV2Schema,
		queries: z
			.array(panelQueryBindingV2Schema)
			.min(1)
			.max(DASHBOARD_V2_LIMITS.maxQueriesPerPanel),
		transformations: z
			.array(transformationSpecV2Schema)
			.max(DASHBOARD_V2_LIMITS.maxTransformationsPerPanel)
			.default([]),
		visualization: visualizationSpecV2Schema,
		accessibleLabel: z.string().trim().min(1).max(256),
		links: z
			.array(panelLinkV2Schema)
			.max(DASHBOARD_V2_LIMITS.maxLinksPerPanel)
			.default([]),
	})
	.strict()
	.superRefine((panel, context) => {
		const queryRefs = new Set<string>();
		for (const [index, query] of panel.queries.entries()) {
			if (queryRefs.has(query.refId))
				context.addIssue({
					code: "custom",
					path: ["queries", index, "refId"],
					message: "query refId must be unique",
				});
			queryRefs.add(query.refId);
		}
		const available = new Set(
			panel.queries.flatMap((query) => query.outputFrameRefs),
		);
		const outputRefs = new Set<string>();
		for (const query of panel.queries)
			for (const ref of query.outputFrameRefs) {
				if (outputRefs.has(ref))
					context.addIssue({
						code: "custom",
						path: ["queries"],
						message: "query output frame refs must be unique",
					});
				outputRefs.add(ref);
			}
		const transformationIds = new Set<string>();
		for (const [index, transformation] of panel.transformations.entries()) {
			if (transformationIds.has(transformation.id))
				context.addIssue({
					code: "custom",
					path: ["transformations", index, "id"],
					message: "transformation ID must be unique",
				});
			transformationIds.add(transformation.id);
			if (outputRefs.has(transformation.outputFrameRefId))
				context.addIssue({
					code: "custom",
					path: ["transformations", index, "outputFrameRefId"],
					message: "output refId collides with an existing frame",
				});
			for (const [inputIndex, ref] of transformation.inputFrameRefs.entries())
				if (!available.has(ref))
					context.addIssue({
						code: "custom",
						path: ["transformations", index, "inputFrameRefs", inputIndex],
						message:
							"transformation input must reference a query or earlier transformation",
					});
			outputRefs.add(transformation.outputFrameRefId);
			if (!transformation.disabled)
				available.add(transformation.outputFrameRefId);
			if (
				transformation.inputFrameRefs.includes(transformation.outputFrameRefId)
			)
				context.addIssue({
					code: "custom",
					path: ["transformations", index, "outputFrameRefId"],
					message: "transformation cannot reference its own output",
				});
		}
		for (const [index, ref] of panel.visualization.frameRefs.entries())
			if (!available.has(ref))
				context.addIssue({
					code: "custom",
					path: ["visualization", "frameRefs", index],
					message: "visualization frame ref is not available",
				});
		for (const [index, layer] of (
			panel.visualization.annotationLayers ?? []
		).entries()) {
			if (!available.has(layer.frameRef))
				context.addIssue({
					code: "custom",
					path: ["visualization", "annotationLayers", index, "frameRef"],
					message: "annotation frame ref is not available",
				});
		}
		if (
			new Set(panel.visualization.overrides.map((override) => override.id))
				.size !== panel.visualization.overrides.length
		)
			context.addIssue({
				code: "custom",
				path: ["visualization", "overrides"],
				message: "override IDs must be unique",
			});
		if (new Set(panel.links.map((link) => link.id)).size !== panel.links.length)
			context.addIssue({
				code: "custom",
				path: ["links"],
				message: "panel link IDs must be unique",
			});
	});
export type PanelManifestV2 = z.infer<typeof panelManifestV2Schema>;

export const dashboardManifestV2Schema = z
	.object({
		schemaVersion: z.literal(2),
		revision: z.number().int().min(1),
		id: dashboardIdSchema,
		title: z.string().trim().min(1).max(128),
		description: z.string().trim().max(512).default(""),
		layoutVersion: z.number().int().min(1),
		defaultRange: dashboardRangeV2Schema,
		defaultTimezone: dashboardTimezoneV2Schema,
		defaultRefreshSeconds: z.number().int().min(0).max(3600).default(0),
		variables: z.array(variableManifestV2Schema).max(20).default([]),
		panels: z.array(panelManifestV2Schema).min(1).max(160),
		inspectorEnabled: z.boolean().default(true),
	})
	.strict()
	.superRefine((manifest, context) => {
		const panelIds = manifest.panels.map((panel) => panel.id);
		if (new Set(panelIds).size !== panelIds.length)
			context.addIssue({
				code: "custom",
				path: ["panels"],
				message: "panel IDs must be unique",
			});
		const variableIds = manifest.variables.map((variable) => variable.id);
		if (new Set(variableIds).size !== variableIds.length)
			context.addIssue({
				code: "custom",
				path: ["variables"],
				message: "variable IDs must be unique",
			});
		const known = new Set<string>();
		for (const [index, variable] of manifest.variables.entries()) {
			for (const dependency of variable.dependsOn) {
				if (!known.has(dependency))
					context.addIssue({
						code: "custom",
						path: ["variables", index, "dependsOn"],
						message: "variables may depend only on earlier variables",
					});
				if (dependency === variable.id)
					context.addIssue({
						code: "custom",
						path: ["variables", index, "dependsOn"],
						message: "variable cannot depend on itself",
					});
			}
			known.add(variable.id);
		}
	});
export type DashboardManifestV2 = z.infer<typeof dashboardManifestV2Schema>;

export const publicVariableManifestV2Schema = z
	.object({
		id: dashboardVariableIdSchema,
		label: z.string().trim().min(1).max(128),
		description: z.string().trim().max(512).optional(),
		selection: z.enum(["single", "multiple"]),
		required: z.boolean().default(false),
		defaultValues: z
			.array(z.string().trim().min(1).max(128))
			.max(50)
			.default([]),
		dependsOn: z.array(dashboardVariableIdSchema).max(20).default([]),
		source: z.union([
			z.object({ kind: z.literal("static") }).strict(),
			querySource,
		]),
	})
	.strict();
export type PublicVariableManifestV2 = z.infer<
	typeof publicVariableManifestV2Schema
>;
export const publicDashboardManifestV2Schema = z
	.object({
		schemaVersion: z.literal(2),
		revision: z.number().int().min(1),
		id: dashboardIdSchema,
		title: z.string().trim().min(1).max(128),
		description: z.string().trim().max(512).default(""),
		layoutVersion: z.number().int().min(1),
		defaultRange: dashboardRangeV2Schema,
		defaultTimezone: dashboardTimezoneV2Schema,
		defaultRefreshSeconds: z.number().int().min(0).max(3600).default(0),
		variables: z.array(publicVariableManifestV2Schema).max(20).default([]),
		panels: z.array(panelManifestV2Schema).min(1).max(160),
		inspectorEnabled: z.boolean().default(true),
	})
	.strict();
export type PublicDashboardManifestV2 = z.infer<
	typeof publicDashboardManifestV2Schema
>;

export function toPublicDashboardManifestV2(
	manifest: DashboardManifestV2,
): PublicDashboardManifestV2 {
	return {
		...manifest,
		variables: manifest.variables.map((variable) => ({
			...variable,
			source:
				variable.source.kind === "static"
					? { kind: "static" as const }
					: variable.source,
		})),
	};
}
