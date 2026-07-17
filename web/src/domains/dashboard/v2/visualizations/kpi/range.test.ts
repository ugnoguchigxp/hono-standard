import { describe, expect, it } from "vitest";
import { niceMax, normalizeKpiValue, resolveKpiRange } from "./range";

describe("KPI range", () => {
	it("uses stable nice maxima and preserves overflow", () => {
		expect(niceMax(72)).toBe(100);
		expect(resolveKpiRange(72, { values: [72], goal: 80 })).toEqual({ min: 0, max: 100 });
		expect(normalizeKpiValue(120, { min: 0, max: 100 })).toMatchObject({ normalized: 1.2, overflow: "above" });
		expect(normalizeKpiValue(120, { min: 0, max: 100 }, "reject")).toEqual({ error: "value is outside range" });
	});
	it("rejects invalid configured ranges", () => {
		expect(resolveKpiRange(1, { min: 10, max: 1, config: { min: "config", max: "config", overflow: "reject" } })).toEqual({ error: "min must be less than max" });
	});
});
