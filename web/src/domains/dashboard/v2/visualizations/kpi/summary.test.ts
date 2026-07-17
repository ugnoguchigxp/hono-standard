import { describe, expect, it } from "vitest";
import { kpiSummary } from "./summary";

describe("kpiSummary", () => {
	it("includes previous, delta sentiment, goal, and state", () => {
		const summary = kpiSummary({
			items: [{
				id: "A:value",
				label: "Error rate",
				current: 0.024,
				previous: 0.027,
				delta: -0.003,
				goal: 0.02,
				state: "warning",
				sentiment: "improved",
				formatted: {
					current: "2.4%",
					previous: "2.7%",
					delta: "-0.3 points",
					goal: "2%",
					min: undefined,
					max: undefined,
				},
			}],
		}, "Service health");
		expect(summary).toContain("previous 2.7%");
		expect(summary).toContain("improved");
		expect(summary).toContain("goal 2%");
		expect(summary).toContain("warning");
	});

	it("previews five list items and reports state counts", () => {
		const items = Array.from({ length: 7 }, (_, index) => ({
			id: `A:value:${index}`,
			label: `service-${index}`,
			current: index,
			state: index === 0 ? "critical" as const : "healthy" as const,
			sentiment: "neutral" as const,
			formatted: {
				current: String(index),
				previous: undefined,
				delta: undefined,
				goal: undefined,
				min: undefined,
				max: undefined,
			},
		}));
		const summary = kpiSummary({ items });
		expect(summary).toContain("7 items");
		expect(summary).toContain("1 critical");
		expect(summary).toContain("6 healthy");
		expect(summary).toContain("service-4");
		expect(summary).toContain("2 more");
		expect(summary.length).toBeLessThanOrEqual(1000);
	});
});
