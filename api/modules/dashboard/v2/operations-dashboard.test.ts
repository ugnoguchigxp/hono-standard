import { describe, expect, it } from "vitest";
import { createDashboardModule } from "..";
import { galleryVisualizations } from "./gallery-dashboard";
import {
	OPERATIONS_DASHBOARD_ID,
	operationsDashboardV2,
} from "./operations-dashboard";

describe("native operations dashboard", () => {
	it("registers and executes every panel with its declared output shape", async () => {
		const module = createDashboardModule({
			dashboards: [],
			nativeDashboards: [operationsDashboardV2],
			visualizations: galleryVisualizations,
		});
		const panels = module.v2Registry.get(OPERATIONS_DASHBOARD_ID)?.manifest.panels;
		expect(panels).toHaveLength(8);

		for (const panel of panels ?? []) {
			const response = await module.service.queryPanel({
				requestId: module.requestIdFactory(),
				requestTime: new Date("2026-01-01T01:00:00.000Z"),
				auth: {
					userId: "test",
					email: "test@example.com",
					role: "admin",
				},
				dashboardId: OPERATIONS_DASHBOARD_ID,
				panelId: panel.id,
				transportVersion: 2,
				request: {
					schemaVersion: 2,
					range: { kind: "relative", value: "1h" },
					timezone: "UTC",
					filters: { service: ["api"], region: ["global"] },
					maxDataPoints: 100,
					maxRows: 100,
				},
				signal: new AbortController().signal,
			});
			if (!("frames" in response)) throw new Error("expected v2 response");
			expect(response.frames).toHaveLength(1);
			expect(response.frames[0]?.meta.shapeHint).toBeTruthy();
		}

		const workerResponse = await module.service.queryPanel({
			requestId: module.requestIdFactory(),
			requestTime: new Date("2026-01-01T01:00:00.000Z"),
			auth: {
				userId: "test",
				email: "test@example.com",
				role: "admin",
			},
			dashboardId: OPERATIONS_DASHBOARD_ID,
			panelId: "request-rate",
			transportVersion: 2,
			request: {
				schemaVersion: 2,
				range: { kind: "relative", value: "1h" },
				timezone: "UTC",
				filters: { service: ["worker"], region: ["global"] },
				maxDataPoints: 100,
				maxRows: 100,
			},
			signal: new AbortController().signal,
		});
		if (!("frames" in workerResponse)) throw new Error("expected v2 response");
		expect(workerResponse.frames[0]?.fields[1]?.values[0]).toBeCloseTo(32.24);
	});
});
