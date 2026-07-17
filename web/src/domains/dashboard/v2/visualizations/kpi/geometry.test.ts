import { describe, expect, it } from "vitest";
import {
	arcPath,
	polarPoint,
	segmentCount,
	sparklinePoints,
	valueArcPath,
} from "./geometry";

describe("KPI geometry", () => {
	it("creates deterministic native SVG geometry", () => {
		expect(arcPath(-180, 0)).toBe(
			"M 0.08000 0.50000 A 0.42 0.42 0 0 1 0.92000 0.50000",
		);
		expect(valueArcPath(0.5, -180, 0)).toContain("A");
		expect(polarPoint(-90, 0.42)).toEqual(
			expect.objectContaining({ x: expect.closeTo(0.5), y: expect.closeTo(0.08) }),
		);
		expect(segmentCount(0, 10)).toBe(0);
		expect(segmentCount(1, 10)).toBe(10);
	});
	it("leaves null sparkline gaps out of the path", () => {
		expect(sparklinePoints([1, null, 3])).toBe("0.00,24.00 100.00,0.00");
		expect(sparklinePoints([5, 5])).toBe("0.00,24.00 100.00,24.00");
	});
});
