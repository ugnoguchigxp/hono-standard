import { describe, expect, it } from "vitest";
import { coreTimeseriesVisualizationContract } from "../../../../shared/schemas/dashboard/cartesian-visualizations.schema";
import { panelFixture } from "../../../../shared/schemas/dashboard/test-fixtures";
import { nativeVisualization } from "./test-fixtures";
import { DashboardVisualizationRegistry } from "./visualization-registry";

describe("v2 visualization registry", () => {
	it("parses presets and rejects unknown types", () => {
		const registry = new DashboardVisualizationRegistry([nativeVisualization]);
		expect(registry.parseSpec({ type: "test.timeseries", preset: "line", frameRefs: ["A"], options: {}, fieldConfig: { unit: { kind: "none" }, decimals: "auto", noValueText: "—", textAlign: "auto", valueMappings: [], links: [] }, overrides: [], tableFallback: { enabled: true, defaultView: "visualization" } }).preset).toBe("line");
		expect(() => registry.parseSpec({ type: "test.missing", frameRefs: ["A"], options: {}, fieldConfig: { unit: { kind: "none" }, decimals: "auto", noValueText: "—", textAlign: "auto", valueMappings: [], links: [] }, overrides: [], tableFallback: { enabled: true, defaultView: "visualization" } })).toThrow();
	});
	it("normalizes Cartesian legacy aliases through the shared resolver", () => {
		const registry = new DashboardVisualizationRegistry([
			coreTimeseriesVisualizationContract,
		]);
		const spec = panelFixture().visualization;
		expect(
			registry.parseSpec({
				...spec,
				options: { yAxisScale: "log", yAxisMin: 1 },
			}).config,
		).toMatchObject({ valueAxis: { scale: "log", min: 1 } });
		expect(() =>
			registry.parseSpec({
				...spec,
				options: { yAxisMin: 1, valueAxis: { min: 2 } },
			}),
		).toThrow(/configuration/i);
	});
});
