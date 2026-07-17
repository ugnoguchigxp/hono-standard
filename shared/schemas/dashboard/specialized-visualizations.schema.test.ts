import { describe, expect, it } from "vitest";
import {
	coreCandlestickVisualizationContract,
	coreNodeGraphVisualizationContract,
	geoMapVisualizationContract,
	observabilityFlameVisualizationContract,
	observabilityLogsVisualizationContract,
	observabilityTraceVisualizationContract,
} from "./specialized-visualizations.schema";

describe("specialized visualization contracts", () => {
	it("exposes exactly five presets and strict defaults for every family", () => {
		const definitions = [coreNodeGraphVisualizationContract, coreCandlestickVisualizationContract, observabilityLogsVisualizationContract, observabilityTraceVisualizationContract, observabilityFlameVisualizationContract, geoMapVisualizationContract];
		expect(definitions.map((item) => item.descriptor.presets)).toHaveLength(6);
		for (const definition of definitions) {
			expect(definition.descriptor.presets).toHaveLength(5);
			for (const [preset, options] of Object.entries(definition.defaultOptionsByPreset)) expect(definition.configSchema.parse(options)).toBeTruthy();
		}
	});

	it("rejects strategy keys and invalid bounds", () => {
		expect(coreNodeGraphVisualizationContract.configSchema.safeParse({ strategy: "force" }).success).toBe(false);
		expect(observabilityLogsVisualizationContract.configSchema.safeParse({ attributeFields: ["service", "service"] }).success).toBe(false);
		expect(geoMapVisualizationContract.configSchema.safeParse({ clusterCellPx: 8 }).success).toBe(false);
	});
});
