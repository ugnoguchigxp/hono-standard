import { describe, expect, it } from "vitest";
import { coreHistogramTransformationContract, histogramTransformationConfigV1Schema } from "./histogram-transformation.schema";
describe("histogram transformation contract", () => {
	it("uses browser-only deterministic defaults", () => { const config = histogramTransformationConfigV1Schema.parse({}); expect(config.binning.mode).toBe("sturges"); expect(coreHistogramTransformationContract.descriptor.browserCapable).toBe(true); expect(coreHistogramTransformationContract.descriptor.serverCapable).toBe(false); });
	it("rejects zero width and reversed ranges", () => { expect(histogramTransformationConfigV1Schema.safeParse({ binning: { mode: "fixed-width", width: 0 } }).success).toBe(false); expect(histogramTransformationConfigV1Schema.safeParse({ range: { min: 2, max: 1 } }).success).toBe(false); });
});
