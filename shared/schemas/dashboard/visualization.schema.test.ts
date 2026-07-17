import { z } from "zod";
import { describe, expect, it } from "vitest";
import { validateVisualizationDefinition, visualizationSpecV2Schema } from "./visualization.schema";
import { panelFixture } from "./test-fixtures";

describe("visualization contract", () => {
	it("keeps unknown types transport-safe and validates options through a definition", () => {
		const spec = visualizationSpecV2Schema.parse({ ...panelFixture().visualization, type: "plugin.custom" });
		expect(spec.type).toBe("plugin.custom");
		const definition = { descriptor: { type: "core.timeseries", displayName: "Timeseries", description: "", category: "time" as const, configSchemaVersion: 1, presets: [{ id: "line", displayName: "Line", description: "" }], defaultPreset: "line", supportedShapes: ["timeseries" as const], minimumSize: { w: 2, h: 2 }, recommendedSize: { w: 6, h: 4 }, capabilities: { legend: true, tooltip: true, sharedCrosshair: false, zoom: false, rangeSelection: false, annotations: false, fieldOverrides: true, tableFallback: true, exportImage: false, exportData: true, mobileSummary: true } }, configSchema: z.object({ showLegend: z.boolean() }).strict(), defaultOptionsByPreset: { line: { showLegend: true } } };
		expect(validateVisualizationDefinition(visualizationSpecV2Schema.parse({ ...panelFixture().visualization, options: { showLegend: true } }), definition).valid).toBe(true);
		expect(validateVisualizationDefinition(visualizationSpecV2Schema.parse({ ...panelFixture().visualization, options: { unknown: true } }), definition).valid).toBe(false);
	});
});
