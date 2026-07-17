import { standardFieldConfigV2Schema } from "@shared/schemas/dashboard.schema";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { activeThreshold, applyValueMapping, formatDashboardValue } from "./value-format";

const config = standardFieldConfigV2Schema.parse({ unit: { kind: "percent", scale: "hundred" }, decimals: 1, noValueText: "N/A", textAlign: "auto", valueMappings: [{ kind: "value", value: 1, text: "one" }], links: [] });
describe("dashboard value format", () => {
	it("keeps null and zero distinct", () => { expect(formatDashboardValue(null, config)).toBe("N/A"); expect(formatDashboardValue(0, config)).toBe("0.0%"); expect(applyValueMapping(1, config)?.text).toBe("one"); });
	it("distinguishes hundred and unit percent scales", () => {
		expect(formatDashboardValue(2.4, config)).toBe("2.4%");
		expect(
			formatDashboardValue(
				0.024,
				standardFieldConfigV2Schema.parse({
					unit: { kind: "percent", scale: "unit" },
					decimals: 1,
				}),
			),
		).toBe("2.4%");
	});
	it("formats standard units and mapping kinds", () => {
		const base = standardFieldConfigV2Schema.parse({ decimals: 1, noValueText: "N/A", textAlign: "auto", valueMappings: [], links: [] });
		expect(formatDashboardValue(true, base)).toBe("true");
		expect(formatDashboardValue(Number.NaN, base)).toBe("N/A");
		expect(formatDashboardValue("not-a-duration", { ...base, unit: { kind: "duration", unit: "ms" } })).toBe("not-a-duration");
		expect(formatDashboardValue(1_500, { ...base, unit: { kind: "bytes", base: 1000 } })).toBe("1.5 kB");
		expect(formatDashboardValue(2, { ...base, unit: { kind: "currency", code: "USD" } })).toContain("$");
		expect(formatDashboardValue(2, { ...base, unit: { kind: "duration", unit: "s" } })).toContain("s");
		expect(formatDashboardValue(2, { ...base, unit: { kind: "rate", suffix: "/s" } })).toContain("/s");
		expect(formatDashboardValue(2, { ...base, unit: { kind: "custom", suffix: " widgets" } })).toContain("widgets");
		expect(formatDashboardValue(1_200, { ...base, unit: { kind: "short" } })).toContain("1.2");
		expect(formatDashboardValue("2026-07-16T00:00:00Z", base, "en-US", "UTC", "time")).toContain("2026");
		const mappings = { ...base, valueMappings: [{ kind: "null" as const, text: "empty" }, { kind: "range" as const, from: 1, to: 3, text: "range" }] };
		expect(applyValueMapping(null, mappings)?.text).toBe("empty");
		expect(applyValueMapping(2, mappings)?.text).toBe("range");
		expect(applyValueMapping(9, mappings)).toBeUndefined();
	});
	it("selects the latest threshold", () => {
		const thresholds = { ...config, thresholds: { mode: "absolute" as const, steps: [{ value: null, colorToken: "--color-brand" }, { value: 10, colorToken: "--color-amber" }, { value: 20, colorToken: "--color-rose" }] } };
		expect(activeThreshold(15, thresholds)?.colorToken).toBe("--color-amber");
		expect(activeThreshold(null, thresholds)).toBeUndefined();
		expect(activeThreshold(1, { ...config, thresholds: undefined })).toBeUndefined();
	});
});
