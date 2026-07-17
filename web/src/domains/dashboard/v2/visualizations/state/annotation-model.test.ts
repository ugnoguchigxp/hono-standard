import { describe, expect, it } from "vitest";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { buildAnnotationModel } from "./annotation-model";

const annotationFrame: DashboardDataFrameV2 = { schemaVersion: 2, refId: "B", source: { kind: "query", refId: "B" }, name: "events", fields: [{ key: "time", label: "Time", type: "time", values: [10, 20], roles: ["time"], labels: {} }, { key: "message", label: "Message", type: "string", values: ["deploy", "incident"], roles: ["message"], labels: {} }, { key: "severity", label: "Severity", type: "string", values: ["info", "critical"], roles: ["severity"], labels: {} }, { key: "url", label: "URL", type: "string", values: ["/protected", "javascript:alert(1)"], roles: ["url"], labels: {} }], meta: { shapeHint: "annotation" } };
describe("annotation model", () => {
	it("filters, clips, clusters, and keeps unsafe links out", () => {
		const result = buildAnnotationModel({ id: "incidents", frameRef: "B", mode: "point", enabled: true, name: "Incidents", colorToken: "--color-chart-danger", severityFilter: ["critical"], showLabel: "always" }, annotationFrame, { from: 0, to: 30 });
		expect(result.annotations).toHaveLength(1);
		expect(result.annotations[0]?.safeLink).toBeUndefined();
		expect(result.clusters[0]?.count).toBe(1);
	});
	it("rejects mixed form and duplicate annotation IDs", () => {
		const bad = { ...annotationFrame, fields: [...annotationFrame.fields, { key: "start", label: "Start", type: "time" as const, values: [10, 20], roles: ["start-time" as const], labels: {} }] };
		expect(() => buildAnnotationModel({ id: "a", frameRef: "B", mode: "point", enabled: true, name: "A", severityFilter: [], showLabel: "always" }, bad, { from: 0, to: 30 })).toThrow(/FORM_MISMATCH/);
	});
	it("enforces display mode shape and maps severity colors", () => {
		expect(() =>
			buildAnnotationModel(
				{ id: "regions", frameRef: "B", mode: "region", enabled: true, name: "Regions", severityFilter: [], showLabel: "always" },
				annotationFrame,
				{ from: 0, to: 30 },
			),
		).toThrow("ANNOTATION_MODE_SHAPE_MISMATCH");
		const result = buildAnnotationModel(
			{ id: "events", frameRef: "B", mode: "line", enabled: true, name: "Events", severityFilter: ["critical"], showLabel: "always" },
			annotationFrame,
			{ from: 0, to: 30 },
		);
		expect(result.annotations[0]?.colorToken).toBe("--color-chart-danger");
	});
});
