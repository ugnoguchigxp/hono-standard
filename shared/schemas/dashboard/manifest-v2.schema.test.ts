import { describe, expect, it } from "vitest";
import { dashboardManifestV2Schema, panelManifestV2Schema, publicDashboardManifestV2Schema } from "./manifest-v2.schema";
import { panelFixture } from "./test-fixtures";

describe("manifest v2", () => {
	it("validates panel references, layout, and public source shape", () => {
		const panel = panelFixture();
		const manifest = dashboardManifestV2Schema.parse({ schemaVersion: 2, revision: 1, id: "ops", title: "Ops", layoutVersion: 1, defaultRange: { kind: "relative", value: "1h" }, defaultTimezone: "UTC", panels: [panel] });
		expect(manifest.panels[0]?.queries[0]?.hidden).toBe(false);
		expect(publicDashboardManifestV2Schema.safeParse({ ...manifest, variables: [{ id: "service", label: "Service", selection: "single", source: { kind: "static" } }] }).success).toBe(true);
		expect(panelManifestV2Schema.safeParse({ ...panel, transformations: [{ id: "t", type: "core.sort", inputFrameRefs: ["A"], outputFrameRefId: "B", options: {} }, { id: "u", type: "core.sort", inputFrameRefs: ["B"], outputFrameRefId: "C", options: {} }], visualization: { ...panel.visualization, frameRefs: ["C"] } }).success).toBe(true);
		expect(panelManifestV2Schema.safeParse({ ...panel, layout: { ...panel.layout, x: 8, w: 8 } }).success).toBe(false);
	});
	it("requires explicit one-to-four output frame refs", () => {
		const panel = panelFixture();
		expect(panelManifestV2Schema.safeParse({ ...panel, queries: [{ ...panel.queries[0], outputFrameRefs: [] }] }).success).toBe(false);
		expect(panelManifestV2Schema.safeParse({ ...panel, queries: [{ ...panel.queries[0], outputFrameRefs: ["A", "A"] }] }).success).toBe(false);
		expect(panelManifestV2Schema.safeParse({ ...panel, queries: [{ ...panel.queries[0], outputFrameRefs: ["A", "B", "C", "D"] }] }).success).toBe(true);
		expect(panelManifestV2Schema.safeParse({ ...panel, queries: [{ ...panel.queries[0], outputFrameRefs: ["A", "B"] }], visualization: { ...panel.visualization, frameRefs: ["B"] } }).success).toBe(true);
		expect(panelManifestV2Schema.safeParse({ ...panel, queries: [{ ...panel.queries[0], outputFrameRefs: ["A", "B"] }, { ...panel.queries[0], refId: "B", outputFrameRefs: ["B"] }] }).success).toBe(false);
	});
});
