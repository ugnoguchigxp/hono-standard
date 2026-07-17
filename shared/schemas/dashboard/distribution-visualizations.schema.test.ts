import { describe, expect, it } from "vitest";
import { boxPlotConfigV1Schema, calendarHeatmapConfigV1Schema, coreBoxPlotVisualizationContract, coreCalendarHeatmapVisualizationContract, coreHeatmapVisualizationContract, coreHistogramVisualizationContract, heatmapConfigV1Schema, histogramConfigV1Schema } from "./distribution-visualizations.schema";

describe("distribution visualization contracts", () => {
	it("parses all four strict default configs", () => { expect(histogramConfigV1Schema.parse({}).normalization).toBe("count"); expect(heatmapConfigV1Schema.parse({}).cellGap).toBe(2); expect(boxPlotConfigV1Schema.parse({}).pointJitter).toBe(0.12); expect(calendarHeatmapConfigV1Schema.parse({}).weekStartsOn).toBe("monday"); });
	it("rejects unsafe or invalid scale options", () => { expect(histogramConfigV1Schema.safeParse({ unknown: true }).success).toBe(false); expect(heatmapConfigV1Schema.safeParse({ colorScale: { mode: "diverging", domain: { min: 0, max: 1 }, steps: 5, emptyColorToken: "--color-muted" } }).success).toBe(false); });
	it("rejects invalid log domains and summary means", () => {
		expect(
			histogramConfigV1Schema.safeParse({
				xScale: { mode: "log", min: "auto", max: 0 },
			}).success,
		).toBe(false);
		expect(
			boxPlotConfigV1Schema.safeParse({
				inputMode: "summary",
				showMean: true,
			}).success,
		).toBe(false);
	});
	it("exposes five presets per family", () => { expect(coreHistogramVisualizationContract.descriptor.presets).toHaveLength(5); expect(coreHeatmapVisualizationContract.descriptor.presets).toHaveLength(5); expect(coreBoxPlotVisualizationContract.descriptor.presets).toHaveLength(5); expect(coreCalendarHeatmapVisualizationContract.descriptor.presets).toHaveLength(5); });
});
