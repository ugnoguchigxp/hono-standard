import { describe, expect, it } from "vitest";
import { detectDashboardPayloadVersion, panelQueryRequestV2Schema, panelQueryResponseV2Schema, panelQueryResponseAnyVersionSchema, panelDataStateV2Schema, dashboardErrorResponseV2Schema, panelQueryRequestAnyVersionSchema } from "./transport-v2.schema";
import { timeseriesFrame } from "./test-fixtures";

describe("transport v2", () => {
	it("applies request defaults and checks response counts/state", () => {
		expect(panelQueryRequestV2Schema.parse({ schemaVersion: 2, range: { kind: "relative", value: "15m" }, timezone: "UTC" })).toMatchObject({ maxDataPoints: 800, maxRows: 2000, filters: {} });
		const frame = timeseriesFrame();
		const response = panelQueryResponseV2Schema.parse({ schemaVersion: 2, requestId: "00000000-0000-4000-8000-000000000001", generatedAt: "2026-07-16T00:00:00.000Z", resolvedRange: { from: "2026-07-16T00:00:00.000Z", to: "2026-07-16T01:00:00.000Z" }, durationMs: 1, counts: { frames: 1, fields: 2, rows: 2, cells: 4 }, state: {}, frames: [frame] });
		expect(response.counts.cells).toBe(4);
		expect(panelDataStateV2Schema.safeParse({ partial: true, notices: [] }).success).toBe(false);
		expect(dashboardErrorResponseV2Schema.safeParse({ error: { code: "INVALID_JSON_VALUE", message: "bad", requestId: "00000000-0000-4000-8000-000000000001", retryable: false } }).success).toBe(true);
		expect(dashboardErrorResponseV2Schema.safeParse({ error: { code: "PANEL_TIMEOUT", message: "timed out", requestId: "00000000-0000-4000-8000-000000000001", retryable: true } }).success).toBe(true);
	});
	it("detects and parses any-version payloads", () => {
		expect(detectDashboardPayloadVersion({})).toBe(1);
		expect(detectDashboardPayloadVersion({ schemaVersion: 2 })).toBe(2);
		expect(() => detectDashboardPayloadVersion({ schemaVersion: 9 })).toThrow("SCHEMA_VERSION_UNSUPPORTED");
		expect(panelQueryRequestAnyVersionSchema.parse({ schemaVersion: 2, range: { kind: "relative", value: "15m" }, timezone: "UTC" }).version).toBe(2);
		expect(panelQueryResponseAnyVersionSchema.safeParse({ schemaVersion: 2 }).success).toBe(false);
	});
});
