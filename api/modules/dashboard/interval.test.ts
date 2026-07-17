import { describe, expect, it } from "vitest";
import { bucketStarts, chooseIntervalMs, resolveDashboardRange } from "./interval";

describe("dashboard interval", () => {
	it("resolves relative ranges with one server now", () => {
		const now = new Date("2026-07-16T01:00:00.000Z");
		let calls = 0;
		const resolved = resolveDashboardRange({ kind: "relative", value: "1h" }, () => {
			calls += 1;
			return now;
		});
		expect(calls).toBe(1);
		expect(resolved.from.toISOString()).toBe("2026-07-16T00:00:00.000Z");
		expect(resolved.to).toBe(now);
	});

	it("chooses a nice fixed interval and half-open bucket starts", () => {
		const resolved = { from: new Date(0), to: new Date(60_000) };
		const interval = chooseIntervalMs(resolved, 10);
		expect(interval).toBe(10_000);
		expect(bucketStarts(resolved, interval).map((date) => date.getTime())).toEqual([0, 10_000, 20_000, 30_000, 40_000, 50_000]);
	});

	it("rejects ranges above the contract limit", () => {
		expect(() => resolveDashboardRange({ kind: "absolute", from: "2020-01-01T00:00:00.000Z", to: "2026-01-01T00:00:00.000Z" }, () => new Date())).toThrow(/limit/);
	});
});
