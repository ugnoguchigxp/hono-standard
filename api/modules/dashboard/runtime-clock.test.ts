import { describe, expect, it } from "vitest";
import { createSystemDashboardRuntimeClock, createTestDashboardRuntimeClock } from "./runtime-clock";

describe("dashboard runtime clock", () => {
	it("separates wall and monotonic time and validates request IDs", () => {
		const clock = createTestDashboardRuntimeClock({ requestIdFactory: () => "00000000-0000-4000-8000-000000000001" });
		const first = clock.now();
		clock.advance(25);
		expect(clock.monotonicMs()).toBe(25);
		expect(clock.now().getTime() - first.getTime()).toBe(25);
		expect(clock.requestId()).toContain("000000000001");
		expect(() => createSystemDashboardRuntimeClock(() => "bad").requestId()).toThrow();
	});
});
