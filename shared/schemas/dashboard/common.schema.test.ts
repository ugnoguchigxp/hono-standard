import { describe, expect, it } from "vitest";
import { dashboardFieldKeySchema, dashboardFrameRefIdSchema, dashboardVisualizationTypeIdSchema } from "./common.schema";
import { mergeDashboardJsonObjects, validateDashboardJsonValue } from "./json-value.schema";

describe("dashboard v2 common and JSON contracts", () => {
	it("validates names and finite JSON values", () => {
		expect(dashboardFrameRefIdSchema.safeParse("A1").success).toBe(true);
		expect(dashboardFrameRefIdSchema.safeParse("a1").success).toBe(false);
		expect(dashboardFieldKeySchema.safeParse("http.status").success).toBe(true);
		expect(dashboardVisualizationTypeIdSchema.safeParse("core.timeseries").success).toBe(true);
		expect(validateDashboardJsonValue({ ok: [1, null, false] }).valid).toBe(true);
		expect(validateDashboardJsonValue({ constructor: true }).valid).toBe(false);
		expect(validateDashboardJsonValue({ value: Number.NaN }).valid).toBe(false);
	});
	it("enforces depth, bytes, cycles, and immutable object merge", () => {
		const cycle: Record<string, unknown> = {}; cycle.self = cycle;
		expect(validateDashboardJsonValue(cycle).issues[0]?.code).toBe("CIRCULAR_REFERENCE");
		const deep = { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: 1 } } } } } } } } } };
		expect(validateDashboardJsonValue(deep).valid).toBe(false);
		const base = { nested: { a: 1 }, list: [1] };
		const result = mergeDashboardJsonObjects(base, { nested: { b: 2 }, list: [3] });
		expect(result).toEqual({ nested: { a: 1, b: 2 }, list: [3] });
		expect(base).toEqual({ nested: { a: 1 }, list: [1] });
	});
});
