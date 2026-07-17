import { describe, expect, it } from "vitest";
import { coreScatterVisualizationContract, scatterConfigV1Schema } from "./relationship-visualizations.schema";

describe("relationship visualization contracts", () => {
	it("has the three relationship presets", () => {
		expect(coreScatterVisualizationContract.descriptor.presets.map((item) => item.id)).toEqual(["scatter", "bubble", "quadrant"]);
	});
	it("rejects invalid bubble and axis ranges", () => {
		expect(scatterConfigV1Schema.safeParse({ bubbleRadius: { min: 20, max: 10 } }).success).toBe(false);
		expect(scatterConfigV1Schema.safeParse({ xAxis: { min: 4, max: 2 } }).success).toBe(false);
	});
});
