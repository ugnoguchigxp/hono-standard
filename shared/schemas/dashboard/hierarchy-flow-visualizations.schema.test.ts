import { describe, expect, it } from "vitest";
import { coreSankeyVisualizationContract, coreSunburstVisualizationContract, coreTreemapVisualizationContract, sankeyConfigV1Schema } from "./hierarchy-flow-visualizations.schema";

describe("hierarchy and flow contracts", () => {
	it("exposes exact preset descriptors", () => {
		expect(coreTreemapVisualizationContract.descriptor.presets.map((item) => item.id)).toEqual(["flat", "nested"]);
		expect(coreSunburstVisualizationContract.descriptor.presets.map((item) => item.id)).toEqual(["sunburst"]);
		expect(coreSankeyVisualizationContract.descriptor.presets.map((item) => item.id)).toEqual(["sankey"]);
	});
	it("keeps Sankey iterations bounded", () => {
		expect(sankeyConfigV1Schema.safeParse({ iterations: 65 }).success).toBe(false);
	});
});
