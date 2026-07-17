import { describe, expect, it } from "vitest";
import { createDashboardModule } from ".";
import { createTestDashboardRuntimeClock } from "./runtime-clock";
import {
	nativeTransformations,
	nativeV2Fixture,
	nativeVisualization,
} from "./v2/test-fixtures";

describe("dashboard module configuration", () => {
	it("keeps the legacy now alias identical to clock.now", () => {
		const now = () => new Date("2026-07-17T00:00:00.000Z");
		const module = createDashboardModule({ now });
		expect(module.now).toBe(module.clock.now);
		expect(module.now).toBe(now);
		expect(() =>
			createDashboardModule({
				now,
				clock: createTestDashboardRuntimeClock(),
			}),
		).toThrow(/clock and now/);
	});

	it("validates request IDs and execution limits at the module boundary", () => {
		const invalidId = createDashboardModule({ requestIdFactory: () => "bad" });
		expect(() => invalidId.requestIdFactory()).toThrow(/UUID/);
		expect(() =>
			createDashboardModule({ limits: { maxConcurrent: 0 } }),
		).toThrow(/maxConcurrent/);
		expect(() =>
			createDashboardModule({
				limits: { handlerTimeoutMs: 20, panelTimeoutMs: 10 },
			}),
		).toThrow(/panelTimeoutMs/);
		expect(() =>
			createDashboardModule({
				limits: {
					handlerTimeoutMs: 50,
					panelTimeoutMs: 100,
					serverTransformationBudgetMs: 100,
				},
			}),
		).toThrow(/serverTransformationBudgetMs/);
	});

	it("rejects dashboard IDs registered in both runtime versions", () => {
		const native = nativeV2Fixture();
		native.manifest.id = "operations";
		expect(() => createDashboardModule({ nativeDashboards: [native], visualizations: [nativeVisualization], transformations: nativeTransformations })).toThrow(/both v1 and v2/);
	});
});
