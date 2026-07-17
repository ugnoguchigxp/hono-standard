import type {
	DashboardManifest,
	VariableOption,
} from "../../../shared/schemas/dashboard.schema";
import { variableOptionSchema } from "../../../shared/schemas/dashboard.schema";
import type {
	DashboardDefinition,
	DashboardVariableOptionsContext,
} from "./types";

export class DashboardRegistryError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DashboardRegistryError";
	}
}

export class DashboardRegistry {
	private readonly dashboards = new Map<string, DashboardDefinition>();

	constructor(definitions: DashboardDefinition[]) {
		for (const definition of definitions) {
			this.validate(definition);
			if (this.dashboards.has(definition.manifest.id)) {
				throw new DashboardRegistryError(
					`Duplicate dashboard id: ${definition.manifest.id}`,
				);
			}
			this.dashboards.set(definition.manifest.id, definition);
		}
	}

	get(dashboardId: string): DashboardDefinition | undefined {
		return this.dashboards.get(dashboardId);
	}

	getManifest(dashboardId: string): DashboardManifest | undefined {
		return this.get(dashboardId)?.manifest;
	}

	getPanel(dashboardId: string, panelId: string) {
		return this.get(dashboardId)?.panels.find(
			(panel) => panel.manifest.id === panelId,
		);
	}

	getVariable(dashboardId: string, variableId: string) {
		return this.get(dashboardId)?.variables.find(
			(variable) => variable.manifest.id === variableId,
		);
	}

	async getVariableOptions(
		dashboardId: string,
		variableId: string,
		context: Omit<
			DashboardVariableOptionsContext,
			"dashboardId" | "variableId"
		>,
	): Promise<VariableOption[]> {
		const variable = this.getVariable(dashboardId, variableId);
		if (!variable)
			throw new DashboardRegistryError(`Unknown variable: ${variableId}`);
		if (variable.manifest.source.kind === "static")
			return variable.manifest.source.options;
		if (!variable.options)
			throw new DashboardRegistryError(
				`Missing options handler: ${variableId}`,
			);
		const options = await variable.options({
			...context,
			dashboardId,
			variableId,
		});
		const parsed = options.map((option) => variableOptionSchema.parse(option));
		const seen = new Set<string>();
		for (const option of parsed) {
			if (seen.has(option.value)) {
				throw new DashboardRegistryError(
					`Duplicate variable option: ${option.value}`,
				);
			}
			seen.add(option.value);
		}
		return parsed
			.sort(
				(left, right) =>
					left.label.localeCompare(right.label) ||
					left.value.localeCompare(right.value),
			)
			.slice(0, 1_000);
	}

	private validate(definition: DashboardDefinition) {
		const variableIds = new Set<string>();
		for (const [index, variable] of definition.variables.entries()) {
			if (variableIds.has(variable.manifest.id)) {
				throw new DashboardRegistryError(
					`Duplicate variable id: ${variable.manifest.id}`,
				);
			}
			variableIds.add(variable.manifest.id);
			if (variable.manifest.source.kind === "query" && !variable.options) {
				throw new DashboardRegistryError(
					`Query variable requires options handler: ${variable.manifest.id}`,
				);
			}
			if (variable.manifest.source.kind === "static") {
				const values = new Set(
					variable.manifest.source.options.map((option) => option.value),
				);
				if (
					variable.manifest.required &&
					variable.manifest.defaultValues.some((value) => !values.has(value))
				) {
					throw new DashboardRegistryError(
						`Static variable default is not an option: ${variable.manifest.id}`,
					);
				}
			}
			for (const dependency of variable.manifest.dependsOn) {
				if (
					!variableIds.has(dependency) &&
					!definition.variables.some((item) => item.manifest.id === dependency)
				) {
					throw new DashboardRegistryError(
						`Unknown variable dependency: ${dependency}`,
					);
				}
				const dependencyIndex = definition.variables.findIndex(
					(item) => item.manifest.id === dependency,
				);
				if (dependencyIndex >= index) {
					throw new DashboardRegistryError(
						`Variable dependency must be declared first: ${dependency}`,
					);
				}
			}
		}
		const visiting = new Set<string>();
		const visited = new Set<string>();
		const visit = (id: string) => {
			if (visiting.has(id))
				throw new DashboardRegistryError(`Variable dependency cycle: ${id}`);
			if (visited.has(id)) return;
			visiting.add(id);
			const variable = definition.variables.find(
				(item) => item.manifest.id === id,
			);
			for (const dependency of variable?.manifest.dependsOn ?? [])
				visit(dependency);
			visiting.delete(id);
			visited.add(id);
		};
		for (const variable of definition.variables) visit(variable.manifest.id);

		const panelIds = new Set<string>();
		const queryIds = new Set<string>();
		for (const panel of definition.panels) {
			if (panelIds.has(panel.manifest.id))
				throw new DashboardRegistryError(
					`Duplicate panel id: ${panel.manifest.id}`,
				);
			panelIds.add(panel.manifest.id);
			if (queryIds.has(panel.manifest.queryId))
				throw new DashboardRegistryError(
					`Duplicate query id: ${panel.manifest.queryId}`,
				);
			queryIds.add(panel.manifest.queryId);
			for (const link of panel.manifest.visualization.links) {
				if (
					!definition.manifest.panels.some(
						(target) => target.id === link.targetId,
					)
				) {
					throw new DashboardRegistryError(
						`Unknown link target: ${link.targetId}`,
					);
				}
			}
		}
		if (definition.manifest.panels.length !== definition.panels.length) {
			throw new DashboardRegistryError(
				"Manifest panels and panel definitions must match",
			);
		}
	}
}
