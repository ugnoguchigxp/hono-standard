import { describe, expect, it } from "vitest";
import { createNoopDashboardRuntimeLogger, safeLog } from "./runtime-logger";

describe("dashboard runtime logger", () => {
	it("does not throw for invalid events or logger failures", () => {
		const events: unknown[] = [];
		const collect = (event: unknown) => events.push(event);
		const logger = { info: collect, warn: collect, error: collect };
		safeLog(logger, { event: "start", requestId: "00000000-0000-4000-8000-000000000001", dashboardId: "ops" });
		safeLog(logger, { event: "late-settlement-rejected", requestId: "00000000-0000-4000-8000-000000000001", dashboardId: "ops", panelId: "overview" });
		safeLog(logger, { event: "unknown" } as never);
		expect(events).toHaveLength(2);
		expect(() =>
			createNoopDashboardRuntimeLogger().info?.({
				event: "start",
				requestId: "00000000-0000-4000-8000-000000000001",
				dashboardId: "ops",
			}),
		).not.toThrow();
	});
});
