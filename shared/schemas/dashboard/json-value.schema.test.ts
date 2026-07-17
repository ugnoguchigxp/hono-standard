import { describe, expect, it } from "vitest";
import { dashboardJsonObjectSchema, validateDashboardJsonValue } from "./json-value.schema";

describe("dashboard JSON value budget", () => {
	it("accepts plain objects and rejects non-JSON objects", () => {
		expect(dashboardJsonObjectSchema.safeParse({ answer: 42 }).success).toBe(true);
		expect(dashboardJsonObjectSchema.safeParse(new Date()).success).toBe(false);
	});
	it("rejects forbidden keys and oversized arrays", () => {
		const forbidden = Object.create(null) as Record<string, unknown>;
		forbidden.__proto__ = true;
		expect(validateDashboardJsonValue(forbidden).valid).toBe(false);
		expect(validateDashboardJsonValue({ prototype: true }).valid).toBe(false);
		expect(validateDashboardJsonValue([], { maxDepth: 8, maxObjectKeys: 128, maxArrayItems: 0, maxBytes: 100 }).valid).toBe(true);
		expect(validateDashboardJsonValue([1], { maxDepth: 8, maxObjectKeys: 128, maxArrayItems: 0, maxBytes: 100 }).valid).toBe(false);
	});
});
