import { describe, expect, it } from "vitest";
import { dashboardDataFrameV2Schema, validateDashboardDataFrameShape, validatePanelFramesAgainstManifest } from "./data-frame.schema";
import { timeseriesFrame } from "./test-fixtures";

describe("data frame", () => {
	it("validates physical fields, roles, and shape minimums", () => {
		const frame = dashboardDataFrameV2Schema.parse(timeseriesFrame());
		expect(validateDashboardDataFrameShape(frame)).toEqual({ valid: true, shape: "timeseries" });
		expect(dashboardDataFrameV2Schema.safeParse({ ...frame, fields: [{ ...frame.fields[0], roles: ["value"] }] }).success).toBe(false);
		expect(dashboardDataFrameV2Schema.safeParse({ ...frame, fields: [{ ...frame.fields[0], values: [1] }, frame.fields[1]] }).success).toBe(false);
	});
	it("checks frame source identity against a panel", () => {
		const frame = dashboardDataFrameV2Schema.parse(timeseriesFrame());
		expect(validatePanelFramesAgainstManifest({ queries: [{ refId: "A" }], transformations: [] }, [frame]).valid).toBe(true);
		expect(validatePanelFramesAgainstManifest({ queries: [{ refId: "B" }], transformations: [] }, [frame]).issues[0]?.code).toBe("UNKNOWN_QUERY_REF");
	});
	it("distinguishes state samples and strict annotation forms", () => {
		const sample = { ...timeseriesFrame(), meta: { shapeHint: "state-sample" as const }, fields: [{ ...timeseriesFrame().fields[0], roles: ["time" as const] }, { ...timeseriesFrame().fields[1], type: "string" as const, values: ["healthy", "warning"], roles: ["state" as const] }] };
		expect(validateDashboardDataFrameShape(dashboardDataFrameV2Schema.parse(sample))).toEqual({ valid: true, shape: "state-sample" });
		const event = { ...timeseriesFrame(), meta: { shapeHint: "annotation" as const }, fields: [{ ...timeseriesFrame().fields[0], roles: ["time" as const] }, { ...timeseriesFrame().fields[1], type: "string" as const, values: ["deploy", "incident"], roles: ["message" as const] }] };
		expect(validateDashboardDataFrameShape(dashboardDataFrameV2Schema.parse(event))).toEqual({ valid: true, shape: "annotation" });
		const blankMessage = dashboardDataFrameV2Schema.parse({
			...event,
			fields: event.fields.map((field, index) =>
				index === 1 ? { ...field, values: [" ", "incident"] } : field,
			),
		});
		expect(validateDashboardDataFrameShape(blankMessage)).toMatchObject({ valid: false, issues: [{ code: "ANNOTATION_MESSAGE_INVALID" }] });
		const duplicateIds = dashboardDataFrameV2Schema.parse({ ...event, fields: [...event.fields, { key: "id", label: "ID", type: "string", values: ["same", "same"], roles: ["id"], labels: {} }] });
		expect(validateDashboardDataFrameShape(duplicateIds)).toMatchObject({ valid: false, issues: [{ code: "ANNOTATION_DUPLICATE_ID" }] });
	});
});
