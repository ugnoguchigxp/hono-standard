import { describe, expect, it } from "vitest";
import { resolveDeltaSentiment, resolveKpiState } from "./state";

describe("KPI semantic state", () => {
	it("keeps color tokens separate from semantic state", () => {
		expect(resolveKpiState(4, { thresholds: { mode: "absolute", steps: [{ value: null, colorToken: "--color-muted" }, { value: 3, colorToken: "--color-chart-danger", label: "critical" }] }, valueMappings: [] })).toBe("critical");
		expect(resolveKpiState(4, { thresholds: undefined, valueMappings: [] })).toBe("unknown");
	});
	it("resolves sentiment by explicit direction", () => {
		expect(resolveDeltaSentiment(2, { mode: "absolute", sentiment: "higher-is-better", zeroTolerance: 0 })).toBe("improved");
		expect(resolveDeltaSentiment(-2, { mode: "absolute", sentiment: "lower-is-better", zeroTolerance: 0 })).toBe("improved");
		expect(resolveDeltaSentiment(0, { mode: "absolute", sentiment: "higher-is-better", zeroTolerance: 0.1 })).toBe("unchanged");
	});
});
