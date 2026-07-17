import { describe, expect, it } from "vitest";
import { dashboardQualityConfig } from "./dashboard-quality-config";

describe("dashboard quality config", () => {
	it("keeps routes, IDs, and viewports deterministic", () => {
		expect(dashboardQualityConfig.dashboardIds.demo).toBe("operations");
		expect(dashboardQualityConfig.dashboardIds.gallery).toBe("visualization-gallery");
		expect(dashboardQualityConfig.routes.gallery).toBe("/dashboard/gallery");
		for (const viewport of Object.values(dashboardQualityConfig.viewports)) {
			expect(viewport.width).toBeGreaterThan(0);
			expect(viewport.height).toBeGreaterThan(0);
		}
	});
});
