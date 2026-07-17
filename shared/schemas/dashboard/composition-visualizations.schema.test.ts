import { describe, expect, it } from "vitest";
import { coreFunnelVisualizationContract, corePieVisualizationContract, coreRadarVisualizationContract, coreRadialBarVisualizationContract, pieConfigV1Schema } from "./composition-visualizations.schema";

describe("composition visualization contracts", () => {
	it("parses every preset default and rejects unknown options", () => {
		for (const definition of [corePieVisualizationContract, coreRadarVisualizationContract, coreRadialBarVisualizationContract, coreFunnelVisualizationContract]) {
			for (const preset of definition.descriptor.presets) expect(definition.configSchema.safeParse(definition.defaultOptionsByPreset[preset.id]).success).toBe(true);
		}
		expect(pieConfigV1Schema.safeParse({ unknown: true }).success).toBe(false);
	});
	it("enforces radial geometry bounds", () => {
		expect(coreRadialBarVisualizationContract.configSchema.safeParse({ innerRadiusPercent: 80, outerRadiusPercent: 20 }).success).toBe(false);
		expect(
			coreRadialBarVisualizationContract.defaultOptionsByPreset.progress,
		).toMatchObject({ max: 100, showTrack: true });
	});
});
