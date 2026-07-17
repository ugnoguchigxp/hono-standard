import { describe, expect, it } from "vitest";
import { createDashboardModule } from "..";
import {
	GALLERY_DASHBOARD_ID,
	galleryCases,
	galleryDashboardV2,
	galleryVisualizations,
} from "./gallery-dashboard";

describe("dashboard visualization gallery", () => {
	it("has one deterministic success or state fixture for every core preset", () => {
		const presets = galleryVisualizations.flatMap((item) =>
			item.descriptor.presets.map((preset) => `${item.descriptor.type}/${preset.id}`),
		);
		const cases = galleryCases.map((item) => `${item.visualizationType}/${item.preset}`);
		expect(new Set(cases)).toEqual(new Set(presets));
	});

	it("passes startup validation and keeps IDs unique", async () => {
		const module = createDashboardModule({
			nativeDashboards: [galleryDashboardV2],
			visualizations: galleryVisualizations,
		});
		expect(module.v2Registry.get(GALLERY_DASHBOARD_ID)?.manifest.panels).toHaveLength(galleryCases.length);
		const first = await module.service.getManifest({
			requestId: "gallery-test-0001",
			requestTime: new Date("2026-01-01T00:00:00.000Z"),
			auth: { userId: "test", email: "test@example.com", role: "admin" },
			dashboardId: GALLERY_DASHBOARD_ID,
			transportVersion: 2,
			signal: new AbortController().signal,
		});
		const second = await module.service.getManifest({
			requestId: "gallery-test-0002",
			requestTime: new Date("2026-01-01T00:00:00.000Z"),
			auth: { userId: "test", email: "test@example.com", role: "admin" },
			dashboardId: GALLERY_DASHBOARD_ID,
			transportVersion: 2,
			signal: new AbortController().signal,
		});
		expect(first).toEqual(second);
		expect(
			galleryDashboardV2.manifest.panels.find(
				(panel) => panel.id === "state-no-value",
			),
		).toMatchObject({
			title: "Unavailable current value",
			description: "The latest sample exists but contains no usable reading",
			visualization: { fieldConfig: { noValueText: "—" } },
		});
	});

	it("executes every deterministic fixture through the v2 coordinator", async () => {
		const module = createDashboardModule({
			dashboards: [],
			nativeDashboards: [galleryDashboardV2],
			visualizations: galleryVisualizations,
		});
		for (const panel of galleryDashboardV2.manifest.panels) {
			const response = await module.service.queryPanel({
				requestId: module.requestIdFactory(),
				requestTime: new Date("2026-01-01T01:00:00.000Z"),
				auth: {
					userId: "test",
					email: "test@example.com",
					role: "admin",
				},
				dashboardId: GALLERY_DASHBOARD_ID,
				panelId: panel.id,
				transportVersion: 2,
				request: {
					schemaVersion: 2,
					range: { kind: "relative", value: "1h" },
					timezone: "UTC",
					filters: {},
					maxDataPoints: 100,
					maxRows: 100,
				},
				signal: new AbortController().signal,
			});
			if (!("frames" in response)) throw new Error("expected v2 response");
			expect(response.frames.length).toBeGreaterThan(0);
		}
	});
});
