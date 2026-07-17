import {
	DASHBOARD_V2_LIMITS,
	mergeDashboardJsonObjects,
	resolveVisualizationConfig,
	validateDashboardJsonValue,
	visualizationDescriptorSchema,
	visualizationSpecV2Schema,
	type DashboardJsonObject,
	type VisualizationDefinition,
	type VisualizationDescriptor,
	type VisualizationSpecV2,
} from "../../../../shared/schemas/dashboard.schema";
import { DashboardRuntimeError } from "../runtime-errors";

export type ParsedVisualizationSpec<T = unknown> = {
	descriptor: VisualizationDescriptor;
	definition: VisualizationDefinition<T>;
	preset: string;
	config: T;
};

export class DashboardVisualizationRegistry {
	private readonly definitions = new Map<
		string,
		VisualizationDefinition<unknown>
	>();
	constructor(definitions: Array<VisualizationDefinition<unknown>>) {
		for (const definition of definitions) {
			const descriptor = visualizationDescriptorSchema.parse(
				definition.descriptor,
			);
			if (this.definitions.has(descriptor.type))
				throw new Error(`Duplicate visualization type: ${descriptor.type}`);
			for (const [preset, options] of Object.entries(
				definition.defaultOptionsByPreset,
			)) {
				if (!descriptor.presets.some((item) => item.id === preset))
					throw new Error("VISUALIZATION_PRESET_INVALID");
				if (
					!validateDashboardJsonValue(options, {
						maxDepth: DASHBOARD_V2_LIMITS.maxJsonDepth,
						maxObjectKeys: DASHBOARD_V2_LIMITS.maxJsonObjectKeys,
						maxArrayItems: DASHBOARD_V2_LIMITS.maxJsonArrayItems,
						maxBytes: DASHBOARD_V2_LIMITS.maxVisualizationOptionsBytes,
					}).valid
				)
					throw new Error("VISUALIZATION_CONFIG_INVALID");
				definition.configSchema.parse(options);
			}
			if (
				Object.keys(definition.defaultOptionsByPreset).length !==
				descriptor.presets.length
			)
				throw new Error("VISUALIZATION_PRESET_INVALID");
			this.definitions.set(descriptor.type, definition);
		}
	}
	get(type: string) {
		return this.definitions.get(type);
	}
	parseSpec(spec: VisualizationSpecV2): ParsedVisualizationSpec {
		const parsed = visualizationSpecV2Schema.parse(spec);
		const definition = this.definitions.get(parsed.type);
		if (!definition)
			throw new DashboardRuntimeError(
				"VISUALIZATION_NOT_REGISTERED",
				422,
				"Visualization is not registered",
				false,
			);
		const descriptor = visualizationDescriptorSchema.parse(
			definition.descriptor,
		);
		const preset = parsed.preset ?? descriptor.defaultPreset;
		const base = definition.defaultOptionsByPreset[preset];
		if (!base || !descriptor.presets.some((item) => item.id === preset))
			throw new DashboardRuntimeError(
				"VISUALIZATION_CONFIG_INVALID",
				422,
				"Visualization preset is invalid",
				false,
			);
		let options: DashboardJsonObject;
		try {
			options = mergeDashboardJsonObjects(base, parsed.options);
			const budget = validateDashboardJsonValue(options, {
				maxDepth: DASHBOARD_V2_LIMITS.maxJsonDepth,
				maxObjectKeys: DASHBOARD_V2_LIMITS.maxJsonObjectKeys,
				maxArrayItems: DASHBOARD_V2_LIMITS.maxJsonArrayItems,
				maxBytes: DASHBOARD_V2_LIMITS.maxVisualizationOptionsBytes,
			});
			if (!budget.valid) throw new Error("budget");
			const config = resolveVisualizationConfig(parsed, definition);
			return {
				descriptor,
				definition,
				preset,
				config,
			};
		} catch (error) {
			throw new DashboardRuntimeError(
				"VISUALIZATION_CONFIG_INVALID",
				422,
				"Visualization configuration is invalid",
				false,
				undefined,
				error,
			);
		}
	}
}
