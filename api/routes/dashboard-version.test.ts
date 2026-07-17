import { describe, expect, it } from "vitest";
import { DASHBOARD_V2_MEDIA_TYPE, detectDashboardRequestVersion, negotiateDashboardAccept } from "./dashboard-version";

describe("dashboard version negotiation", () => {
	it("defaults to v1 and opts into v2 explicitly", () => {
		expect(negotiateDashboardAccept(undefined)).toBe(1);
		expect(negotiateDashboardAccept(`application/json, ${DASHBOARD_V2_MEDIA_TYPE};q=0.1`)).toBe(2);
		expect(() => negotiateDashboardAccept(`${DASHBOARD_V2_MEDIA_TYPE};q=0, application/json;q=0`)).toThrow(expect.objectContaining({ code: "SCHEMA_VERSION_UNSUPPORTED", status: 406 }));
		expect(() => negotiateDashboardAccept("application/vnd.hono-standard.dashboard.v3+json")).toThrow(expect.objectContaining({ code: "SCHEMA_VERSION_UNSUPPORTED", status: 406 }));
	});
	it("detects body versions without changing v1 schema", () => {
		expect(detectDashboardRequestVersion({})).toBe(1);
		expect(detectDashboardRequestVersion({ schemaVersion: 2 })).toBe(2);
	});
});
