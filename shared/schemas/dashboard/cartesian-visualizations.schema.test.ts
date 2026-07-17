import { describe, expect, it } from "vitest";
import {
	barConfigV2Schema,
	coreBarVisualizationContract,
	coreComposedVisualizationContract,
	coreTimeseriesVisualizationContract,
	normalizeCartesianOptionsV1,
	timeseriesConfigV2Schema,
} from "./cartesian-visualizations.schema";

describe("Cartesian visualization contracts", () => {
	it("exposes the complete 18-preset catalog with strict defaults", () => {
		expect(coreTimeseriesVisualizationContract.descriptor.presets).toHaveLength(8);
		expect(coreBarVisualizationContract.descriptor.presets).toHaveLength(9);
		expect(coreComposedVisualizationContract.descriptor.presets).toHaveLength(1);
		for (const contract of [coreTimeseriesVisualizationContract, coreBarVisualizationContract, coreComposedVisualizationContract])
			for (const preset of contract.descriptor.presets)
				expect(contract.configSchema.parse(contract.defaultOptionsByPreset[preset.id])).toBeTruthy();
	});
	it("normalizes legacy aliases without mutation and rejects conflicts", () => {
		const input = { yAxisScale: "log", yAxisMin: 1, mode: "line", fill: "null" };
		const normalized = normalizeCartesianOptionsV1(input);
		expect(normalized).toMatchObject({ valueAxis: { scale: "log", min: 1 } });
		expect(input).toEqual({ yAxisScale: "log", yAxisMin: 1, mode: "line", fill: "null" });
		expect(() => normalizeCartesianOptionsV1({ yAxisMin: 1, valueAxis: { min: 2 } })).toThrow(/conflicting/);
	});
	it("enforces numeric bounds and incompatible percent/log options", () => {
		expect(timeseriesConfigV2Schema.safeParse({ lineWidth: 0 }).success).toBe(false);
		expect(barConfigV2Schema.safeParse({ barGap: 25 }).success).toBe(false);
		expect(timeseriesConfigV2Schema.safeParse({ valueAxis: { scale: "log" }, sparklineShowLastValue: true }).success).toBe(false);
		expect(
			timeseriesConfigV2Schema.safeParse({
				rangeBand: { lowerFieldKey: "value", upperFieldKey: "value" },
			}).success,
		).toBe(false);
	});
});
