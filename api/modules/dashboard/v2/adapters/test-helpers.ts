import type { DashboardQueryHandlerContextV2 } from "../types";

export const dashboardRecordQueryTestContext = (
	overrides: Partial<DashboardQueryHandlerContextV2> = {},
): DashboardQueryHandlerContextV2 => ({
	requestId: "request-1",
	requestTime: new Date("2026-07-18T00:00:00.000Z"),
	dashboardId: "dashboard",
	panelId: "panel",
	queryId: "records",
	queryRefId: "A",
	outputFrameRefs: ["A"],
	range: { kind: "relative", value: "1h" },
	resolvedRange: {
		from: new Date("2026-07-17T23:00:00.000Z"),
		to: new Date("2026-07-18T00:00:00.000Z"),
	},
	timezone: "UTC",
	filters: { status: ["ok"] },
	maxDataPoints: 100,
	maxRows: 10,
	auth: { userId: "user", email: "user@example.com", role: "member" },
	signal: new AbortController().signal,
	...overrides,
});
