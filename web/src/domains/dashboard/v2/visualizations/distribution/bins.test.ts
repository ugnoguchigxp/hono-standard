import { describe, expect, it } from "vitest";
import { binValues, chooseBinCount, normalizeHistogramBins } from "./bins";

describe("histogram bin model", () => {
	 it("supports fixed width, Sturges, and Freedman–Diaconis", () => { expect(binValues([0, 1, 2], { mode: "fixed-width", width: 1 })).toHaveLength(2); expect(chooseBinCount([1, 2, 3, 4], { mode: "sturges" })).toBe(3); expect(chooseBinCount([1, 1, 1], { mode: "freedman-diaconis", fallbackCount: 4 })).toBe(4); });
	it("normalizes ordered bins and rejects overlap", () => { expect(normalizeHistogramBins([{ start: 2, end: 3, count: 1 }, { start: 0, end: 1, count: 1 }])[0]?.start).toBe(0); expect(() => normalizeHistogramBins([{ start: 0, end: 2, count: 1 }, { start: 1, end: 3, count: 1 }])).toThrow("OVERLAP"); });
	it("aligns fixed-width bins to the origin without counting outside the range", () => {
		const bins = binValues(
			[-1, 0, 1, 2, 3],
			{ mode: "fixed-width", width: 2, origin: 1 },
			{ min: 0, max: 2 },
		);
		expect(bins.map((bin) => [bin.start, bin.end, bin.count])).toEqual([
			[-1, 1, 1],
			[1, 3, 2],
		]);
	});
});
