import { describe, expect, it } from "vitest";
import { legacyDashboardManifestToV2, legacyFieldKeyToV2, legacyPanelDataToFrames, legacyPublicDashboardManifestToV2, legacyVisualizationToV2 } from "./compatibility";
import type { DashboardManifest, PanelData, PanelVisualization } from "./legacy-v1.schema";

describe("v1 compatibility", () => {
	it("migrates all legacy panel data kinds deterministically", () => {
		const inputs: PanelData[] = [
			{ kind: "timeseries", series: [{ key: "Requests / s", label: "Requests", unit: "", decimalPlaces: 2 }], rows: [{ time: 1, values: { "Requests / s": 1 } }] },
			{ kind: "category", series: [{ key: "count", label: "Count", unit: "", decimalPlaces: 2 }], rows: [{ category: "api", values: { count: 2 } }] },
			{ kind: "stat", value: 2, previous: 1, delta: 1 },
			{ kind: "table", columns: [{ key: "mixed", label: "Mixed", unit: "", decimalPlaces: 2, align: "left" }], rows: [{ mixed: 1 }, { mixed: "two" }] },
		];
		for (const data of inputs) expect(legacyPanelDataToFrames(data, { refId: "A", frameName: "Frame" }).frames[0]?.schemaVersion).toBe(2);
		const used = new Set<string>();
		expect(legacyFieldKeyToV2("Requests / s", used).key).toBe("Requests_s");
		expect(legacyFieldKeyToV2("Requests / s", used).key).toBe("Requests_s_2");
	});
	it("migrates visualization and full manifests without mutating input", () => {
		const visualization: PanelVisualization = { type: "line", unit: "%", decimalPlaces: 2, showLegend: true, thresholds: [], valueMappings: [], referenceLines: [], fill: "null", connectNulls: false, yAxisScale: "linear", yAxisMin: "auto", yAxisMax: "auto", links: [] };
		expect(legacyVisualizationToV2(visualization).type).toBe("core.timeseries");
		const legacy: DashboardManifest = { id: "ops", title: "Ops", description: "", layoutVersion: 1, defaultRange: { kind: "relative", value: "1h" }, defaultTimezone: "UTC", defaultRefreshSeconds: 0, inspectorEnabled: true, variables: [], panels: [{ id: "p", title: "P", description: "", layout: { x: 0, y: 0, w: 1, h: 1 }, queryId: "q", accessibleLabel: "P", visualization }] };
		const copy = structuredClone(legacy);
		const converted = legacyDashboardManifestToV2(legacy);
		expect(converted.schemaVersion).toBe(2);
		expect(converted.panels[0]?.queries[0]?.outputFrameRefs).toEqual(["A"]);
		expect(legacy).toEqual(copy);
	});
	it("preserves query variable identifiers in public manifests", () => {
		const legacy: DashboardManifest = { id: "ops", title: "Ops", description: "", layoutVersion: 1, defaultRange: { kind: "relative", value: "1h" }, defaultTimezone: "UTC", defaultRefreshSeconds: 0, inspectorEnabled: true, variables: [{ id: "region", label: "Region", selection: "multiple", required: false, defaultValues: [], dependsOn: [], source: { kind: "query", queryId: "region-options" } }], panels: [{ id: "p", title: "P", description: "", layout: { x: 0, y: 0, w: 1, h: 1 }, queryId: "q", accessibleLabel: "P", visualization: { type: "stat", unit: "", decimalPlaces: 0, showLegend: false, thresholds: [], valueMappings: [], referenceLines: [], fill: "null", connectNulls: false, yAxisScale: "linear", yAxisMin: "auto", yAxisMax: "auto", links: [] } }] };
		const publicManifest = {
			...legacy,
			variables: legacy.variables.map(({ source, ...variable }) => ({
				...variable,
				source:
					source.kind === "query"
						? { kind: "query" as const, queryId: source.queryId }
						: { kind: "static" as const },
			})),
		};
		const converted = legacyPublicDashboardManifestToV2(publicManifest);
		expect(converted.variables[0]?.source).toEqual({ kind: "query", queryId: "region-options" });
	});
});
