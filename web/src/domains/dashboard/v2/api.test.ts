// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { DashboardApiErrorV2, fetchDashboardManifestV2, fetchPanelQueryV2, fetchVariableOptionsV2 } from "./api";
import { tableFrame, tablePanel } from "./test/fixtures";
import "./test/setup";

const jsonResponse = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" }, ...init });
const manifest = { schemaVersion: 2 as const, revision: 1, id: "dashboard", title: "Dashboard", description: "", layoutVersion: 1, defaultRange: { kind: "relative" as const, value: "1h" as const }, defaultTimezone: "UTC", defaultRefreshSeconds: 0, variables: [], panels: [tablePanel()], inspectorEnabled: true };
describe("Dashboard v2 API", () => {
	it("sends v2 headers and parses success envelopes", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(manifest)).mockResolvedValueOnce(jsonResponse({ schemaVersion: 2, variableId: "region", options: [] })).mockResolvedValueOnce(jsonResponse({ schemaVersion: 2, requestId: "11111111-1111-4111-8111-111111111111", generatedAt: "2026-07-16T00:00:00.000Z", resolvedRange: { from: "2026-07-16T00:00:00.000Z", to: "2026-07-16T01:00:00.000Z" }, durationMs: 1, counts: { frames: 1, fields: 2, rows: 2, cells: 4 }, state: { partial: false, truncated: false, notices: [] }, frames: [tableFrame([{ name: "a", value: 1 }, { name: "b", value: 2 }])] }));
		await fetchDashboardManifestV2("dashboard");
		await fetchVariableOptionsV2("dashboard", "region", { schemaVersion: 2, range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: {} });
		await fetchPanelQueryV2("dashboard", "panel", { schemaVersion: 2, range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: {}, maxDataPoints: 10, maxRows: 10 });
		expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "POST" });
		expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("Accept")).toContain("dashboard.v2");
		fetchMock.mockRestore();
	});
	it("maps structured and malformed errors without downgrade", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ error: { code: "DASHBOARD_NOT_FOUND", message: "Missing", requestId: "11111111-1111-4111-8111-111111111111", retryable: false } }, { status: 404, headers: { "X-Request-ID": "11111111-1111-4111-8111-111111111111" } }));
		await expect(fetchDashboardManifestV2("missing")).rejects.toMatchObject({ code: "DASHBOARD_NOT_FOUND", status: 404 });
		vi.restoreAllMocks();
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ invalid: true }, { status: 500 }));
		await expect(fetchDashboardManifestV2("broken")).rejects.toBeInstanceOf(DashboardApiErrorV2);
		vi.restoreAllMocks();
	});
	it("rejects request-id mismatches and invalid success payloads", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ error: { code: "DASHBOARD_NOT_FOUND", message: "Missing", requestId: "11111111-1111-4111-8111-111111111111", retryable: false } }, { status: 404, headers: { "X-Request-ID": "22222222-2222-4222-8222-222222222222" } }));
		await expect(fetchDashboardManifestV2("mismatch")).rejects.toMatchObject({ code: "INVALID_HANDLER_RESULT" });
		vi.restoreAllMocks();
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("not-json", { status: 200 }));
		await expect(fetchDashboardManifestV2("invalid-json")).rejects.toMatchObject({ code: "INVALID_HANDLER_RESULT" });
		vi.restoreAllMocks();
	});
	it("rejects mismatched success and variable identifiers", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ schemaVersion: 2, requestId: "11111111-1111-4111-8111-111111111111", generatedAt: "2026-07-16T00:00:00.000Z", resolvedRange: { from: "2026-07-16T00:00:00.000Z", to: "2026-07-16T01:00:00.000Z" }, durationMs: 1, counts: { frames: 1, fields: 2, rows: 2, cells: 4 }, state: { partial: false, truncated: false, notices: [] }, frames: [tableFrame([{ name: "a", value: 1 }, { name: "b", value: 2 }])] }, { headers: { "X-Request-ID": "22222222-2222-4222-8222-222222222222" } }));
		await expect(fetchPanelQueryV2("dashboard", "panel", { schemaVersion: 2, range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: {}, maxDataPoints: 10, maxRows: 10 })).rejects.toMatchObject({ code: "INVALID_HANDLER_RESULT" });
		vi.restoreAllMocks();
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ schemaVersion: 2, variableId: "other", options: [] }));
		await expect(fetchVariableOptionsV2("dashboard", "region", { schemaVersion: 2, range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: {} })).rejects.toMatchObject({ code: "INVALID_HANDLER_RESULT" });
		vi.restoreAllMocks();
	});
});
