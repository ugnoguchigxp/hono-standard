import {
	type DashboardFiltersV2,
	dashboardDataShapeSchema,
	dashboardManifestV2Schema,
	dashboardQueryIdSchema,
	dashboardVariableIdSchema,
	type PanelManifestV2,
	type PublicDashboardManifestV2,
	publicDashboardManifestV2Schema,
	toPublicDashboardManifestV2,
	variableManifestV2Schema,
} from "../../../../shared/schemas/dashboard.schema";
import { DashboardRuntimeError } from "../runtime-errors";
import type { DashboardTransformationRegistry } from "./transformation-registry";
import type {
	DashboardDefinitionV2,
	DashboardQueryDefinitionV2,
	NativePanel,
} from "./types";
import type { DashboardVisualizationRegistry } from "./visualization-registry";

export class DashboardRegistryV2Error extends Error {
	readonly name = "DashboardRegistryV2Error";
}

const fail = (message: string): never => {
	throw new DashboardRegistryV2Error(message);
};

export class DashboardRegistryV2 {
	private readonly dashboards = new Map<string, DashboardDefinitionV2>();
	private readonly publicManifests = new Map<
		string,
		PublicDashboardManifestV2
	>();
	constructor(options: {
		dashboards: DashboardDefinitionV2[];
		visualizations: DashboardVisualizationRegistry;
		transformations: DashboardTransformationRegistry;
	}) {
		for (const definition of options.dashboards) {
			const manifest = dashboardManifestV2Schema.parse(definition.manifest);
			const normalized: DashboardDefinitionV2 = {
				...definition,
				manifest,
				variables: definition.variables.map((variable) => ({
					...variable,
					manifest: variableManifestV2Schema.parse(variable.manifest),
				})),
				queries: definition.queries.map((query) => {
					if (typeof query.handler !== "function")
						fail(`Query handler is required: ${query.id}`);
					if (
						query.interval !== undefined &&
						!["none", "auto"].includes(query.interval)
					)
						fail(`Invalid query interval: ${query.id}`);
					return {
						...query,
						id: dashboardQueryIdSchema.parse(query.id),
						filterKeys: query.filterKeys.map((key) =>
							dashboardVariableIdSchema.parse(key),
						),
						interval: query.interval ?? "auto",
						outputShapes: query.outputShapes.map((shape) =>
							dashboardDataShapeSchema.parse(shape),
						),
					};
				}),
			};
			if (this.dashboards.has(manifest.id))
				fail(`Duplicate dashboard id: ${manifest.id}`);
			this.validateDefinition(
				normalized,
				options.visualizations,
				options.transformations,
			);
			this.dashboards.set(manifest.id, normalized);
			this.publicManifests.set(
				manifest.id,
				publicDashboardManifestV2Schema.parse(
					toPublicDashboardManifestV2(manifest),
				),
			);
		}
	}
	get(dashboardId: string) {
		return this.dashboards.get(dashboardId);
	}
	getManifest(dashboardId: string) {
		return this.get(dashboardId)?.manifest;
	}
	getPublicManifest(
		dashboardId: string,
	): PublicDashboardManifestV2 | undefined {
		const manifest = this.publicManifests.get(dashboardId);
		return manifest ? structuredClone(manifest) : undefined;
	}
	getVariable(dashboardId: string, variableId: string) {
		return this.get(dashboardId)?.variables.find(
			(item) => item.manifest.id === variableId,
		);
	}
	getQuery(dashboardId: string, queryId: string) {
		return this.get(dashboardId)?.queries.find((item) => item.id === queryId);
	}
	getPanel(dashboardId: string, panelId: string): NativePanel | undefined {
		const dashboard = this.get(dashboardId);
		const panel = dashboard?.manifest.panels.find(
			(item) => item.id === panelId,
		);
		if (!dashboard || !panel) return undefined;
		return {
			...panel,
			bindings: panel.queries.map((binding) => ({
				...binding,
				query: dashboard.queries.find(
					(query) => query.id === binding.queryId,
				) as DashboardQueryDefinitionV2,
			})),
		};
	}
	validatePanelFilters(
		dashboardId: string,
		filters: unknown,
		options: { requireRequired?: boolean } = {},
	): DashboardFiltersV2 {
		const dashboard = this.get(dashboardId);
		if (!dashboard)
			throw new DashboardRuntimeError(
				"DASHBOARD_NOT_FOUND",
				404,
				"Dashboard not found",
				false,
			);
		if (!filters || typeof filters !== "object" || Array.isArray(filters))
			throw new DashboardRuntimeError(
				"INVALID_REQUEST",
				400,
				"Invalid dashboard request",
				false,
			);
		const input = filters as Record<string, unknown>;
		const variables = new Map(
			dashboard.variables.map((item) => [item.manifest.id, item.manifest]),
		);
		for (const key of Object.keys(input))
			if (!variables.has(key))
				throw new DashboardRuntimeError(
					"INVALID_REQUEST",
					400,
					"Unknown dashboard filter",
					false,
				);
		const result: DashboardFiltersV2 = {};
		for (const variable of dashboard.variables) {
			const raw = input[variable.manifest.id];
			if (raw === undefined) {
				if (options.requireRequired && variable.manifest.required)
					throw new DashboardRuntimeError(
						"INVALID_REQUEST",
						400,
						"Required dashboard filter is missing",
						false,
					);
				continue;
			}
			if (
				!Array.isArray(raw) ||
				raw.some(
					(value) => typeof value !== "string" || value.trim().length === 0,
				)
			)
				throw new DashboardRuntimeError(
					"INVALID_REQUEST",
					400,
					"Invalid dashboard filter",
					false,
				);
			const values = raw.map((value) => value.trim());
			if (new Set(values).size !== values.length)
				throw new DashboardRuntimeError(
					"INVALID_REQUEST",
					400,
					"Duplicate dashboard filter value",
					false,
				);
			if (variable.manifest.selection === "single" && values.length > 1)
				throw new DashboardRuntimeError(
					"INVALID_REQUEST",
					400,
					"Single dashboard filter accepts one value",
					false,
				);
			if (values.length > 50)
				throw new DashboardRuntimeError(
					"INVALID_REQUEST",
					400,
					"Dashboard filter has too many values",
					false,
				);
			if (variable.manifest.source.kind === "static") {
				const allowed = new Set(
					variable.manifest.source.options
						.filter((option) => !option.disabled)
						.map((option) => option.value),
				);
				if (values.some((value) => !allowed.has(value)))
					throw new DashboardRuntimeError(
						"INVALID_REQUEST",
						400,
						"Invalid static dashboard filter value",
						false,
					);
			}
			result[variable.manifest.id] = values;
		}
		return result;
	}
	validateVariableDependencyFilters(
		dashboardId: string,
		variableId: string,
		filters: unknown,
	) {
		const variable = this.getVariable(dashboardId, variableId);
		if (!variable)
			throw new DashboardRuntimeError(
				"VARIABLE_NOT_FOUND",
				404,
				"Variable not found",
				false,
			);
		const all = this.validatePanelFilters(dashboardId, filters);
		for (const dependency of variable.manifest.dependsOn) {
			const dependencyVariable = this.getVariable(dashboardId, dependency);
			if (
				dependencyVariable?.manifest.required &&
				(!all[dependency] || all[dependency].length === 0)
			)
				throw new DashboardRuntimeError(
					"VARIABLE_DEPENDENCY_INVALID",
					400,
					"Required variable dependency is missing",
					false,
				);
		}
		return Object.fromEntries(
			variable.manifest.dependsOn
				.filter((id) => all[id])
				.map((id) => [id, all[id]]),
		);
	}
	private validateDefinition(
		definition: DashboardDefinitionV2,
		visualizations: DashboardVisualizationRegistry,
		transformations: DashboardTransformationRegistry,
	) {
		const manifest = definition.manifest;
		const variableIds = new Set<string>();
		if (definition.variables.length !== manifest.variables.length)
			fail("Manifest variables and definitions must match");
		for (const [index, variable] of definition.variables.entries()) {
			if (variableIds.has(variable.manifest.id))
				fail(`Duplicate variable id: ${variable.manifest.id}`);
			const manifestVariable = manifest.variables[index];
			if (!manifestVariable || manifestVariable.id !== variable.manifest.id)
				fail("Manifest variable order must match definitions");
			if (
				JSON.stringify(manifestVariable) !== JSON.stringify(variable.manifest)
			)
				fail(`Variable manifest mismatch: ${variable.manifest.id}`);
			variableIds.add(variable.manifest.id);
			if (variable.manifest.source.kind === "query" && !variable.options)
				fail(
					`Query variable requires options handler: ${variable.manifest.id}`,
				);
			if (variable.manifest.source.kind === "static" && variable.options)
				fail(
					`Static variable cannot have options handler: ${variable.manifest.id}`,
				);
			for (const dependency of variable.manifest.dependsOn)
				if (!variableIds.has(dependency))
					fail(`Variable dependency must be declared first: ${dependency}`);
		}
		const queries = new Map<string, DashboardQueryDefinitionV2>();
		for (const query of definition.queries) {
			if (queries.has(query.id)) fail(`Duplicate query id: ${query.id}`);
			if (new Set(query.filterKeys).size !== query.filterKeys.length)
				fail(`Duplicate query filter key: ${query.id}`);
			if (query.filterKeys.some((key) => !variableIds.has(key)))
				fail(`Unknown query filter key: ${query.id}`);
			if (query.outputShapes.length < 1 || query.outputShapes.length > 4)
				fail(`Invalid query output shape count: ${query.id}`);
			queries.set(query.id, query);
		}
		for (const variable of definition.variables) {
			if (
				variable.manifest.source.kind === "query" &&
				!queries.has(variable.manifest.source.queryId)
			)
				fail(`Unknown variable query: ${variable.manifest.source.queryId}`);
			if (variable.manifest.source.kind === "static") {
				const enabledValues = new Set(
					variable.manifest.source.options
						.filter((option) => !option.disabled)
						.map((option) => option.value),
				);
				if (
					variable.manifest.defaultValues.some(
						(value) => !enabledValues.has(value),
					)
				)
					fail(`Static variable default is disabled: ${variable.manifest.id}`);
			}
		}
		const usedQueries = new Set<string>();
		for (const panel of manifest.panels) {
			this.validatePanel(panel, queries, visualizations, transformations);
			for (const binding of panel.queries) usedQueries.add(binding.queryId);
		}
		for (const variable of manifest.variables)
			if (variable.source.kind === "query")
				usedQueries.add(variable.source.queryId);
		for (const query of queries.keys())
			if (!usedQueries.has(query)) fail(`Unused query definition: ${query}`);
	}
	private validatePanel(
		panel: PanelManifestV2,
		queries: Map<string, DashboardQueryDefinitionV2>,
		visualizations: DashboardVisualizationRegistry,
		transformations: DashboardTransformationRegistry,
	) {
		const available = new Map<
			string,
			{ shape: string; execution: "query" | "server" | "browser" }
		>();
		for (const binding of panel.queries) {
			const query = queries.get(binding.queryId);
			if (!query)
				throw new DashboardRegistryV2Error(`Unknown query: ${binding.queryId}`);
			if (binding.outputFrameRefs.length !== query.outputShapes.length)
				fail(`Output frame ref count mismatch: ${binding.refId}`);
			for (const [index, ref] of binding.outputFrameRefs.entries()) {
				if (available.has(ref)) fail(`Output frame ref collision: ${ref}`);
				available.set(ref, {
					shape: query.outputShapes[index] as string,
					execution: "query",
				});
			}
		}
		for (const transformation of panel.transformations) {
			const parsed = transformations.parseSpec(transformation);
			const inputs = transformation.inputFrameRefs.map((ref) => {
				const frame = available.get(ref);
				if (!frame)
					throw new DashboardRegistryV2Error(
						`Unknown transformation input frame: ${ref}`,
					);
				if (
					transformation.execution === "server" &&
					frame.execution === "browser"
				)
					fail("Server transformation cannot depend on browser output");
				return frame;
			}) as Array<{ shape: string; execution: "query" | "server" | "browser" }>;
			if (transformation.disabled) continue;
			if (
				parsed.descriptor.outputShape === "preserve" &&
				inputs.some((input) => input.shape !== inputs[0]?.shape)
			)
				fail(
					`Preserve transformation inputs must have the same shape: ${transformation.id}`,
				);
			const shape =
				parsed.descriptor.outputShape === "preserve"
					? inputs[0]?.shape
					: parsed.descriptor.outputShape === "dynamic"
						? "dynamic"
						: parsed.descriptor.outputShape;
			if (!shape) fail(`Transformation has no input: ${transformation.id}`);
			if (
				parsed.descriptor.inputShapes[0] !== "any" &&
				inputs.some(
					(input) =>
						input.shape !== "dynamic" &&
						!(parsed.descriptor.inputShapes as string[]).includes(input.shape),
				)
			)
				fail(
					`Transformation input shape is incompatible: ${transformation.id}`,
				);
			if (available.has(transformation.outputFrameRefId))
				fail(
					`Transformation output frame ref collision: ${transformation.outputFrameRefId}`,
				);
			available.set(transformation.outputFrameRefId, {
				shape: shape as string,
				execution: transformation.execution,
			});
		}
		const parsedVisualization = visualizations.parseSpec(panel.visualization);
		const minimumSize = parsedVisualization.descriptor.minimumSize;
		if (panel.layout.w < minimumSize.w || panel.layout.h < minimumSize.h)
			fail(`Panel layout is smaller than visualization minimum: ${panel.id}`);
		if (
			(panel.layout.maxW !== undefined && panel.layout.maxW < minimumSize.w) ||
			(panel.layout.maxH !== undefined && panel.layout.maxH < minimumSize.h)
		)
			fail(
				`Panel maximum size is smaller than visualization minimum: ${panel.id}`,
			);
		for (const ref of panel.visualization.frameRefs) {
			const frame = available.get(ref);
			if (!frame)
				throw new DashboardRegistryV2Error(
					`Unknown visualization frame ref: ${ref}`,
				);
			if (
				frame.shape !== "dynamic" &&
				!(parsedVisualization.descriptor.supportedShapes as string[]).includes(
					frame.shape,
				)
			)
				fail(`Visualization does not support frame shape: ${ref}`);
		}
	}
}
