import { describe, expect, it } from "vitest";
import {
	resolveSpecializedFieldConfig,
	validateOhlcUnits,
	resolveTraceDurationMultiplier,
} from "./units";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";

describe("specialized units utils", () => {
	const spec: any = {
		fieldConfig: { unit: { kind: "currency", code: "USD" } },
		overrides: [],
	};

	const frame: DashboardDataFrameV2 = {
		schemaVersion: 2,
		refId: "A",
		source: { kind: "query", refId: "A" },
		name: "OHLC",
		fields: [
			{ key: "time", label: "Time", type: "time", values: [1], roles: ["time"], labels: {} },
			{ key: "open", label: "Open", type: "number", values: [10], roles: ["open"], labels: {} },
			{ key: "high", label: "High", type: "number", values: [15], roles: ["high"], labels: {} },
			{ key: "low", label: "Low", type: "number", values: [5], roles: ["low"], labels: {} },
			{ key: "close", label: "Close", type: "number", values: [12], roles: ["close"], labels: {} },
		],
		meta: { shapeHint: "ohlc" },
	};

	it("resolveSpecializedFieldConfig should return resolved config", () => {
		const field = frame.fields[1]!;
		const result = resolveSpecializedFieldConfig(spec, frame, field);
		expect(result.unit).toEqual({ kind: "currency", code: "USD" });
	});

	it("validateOhlcUnits should validate matching units", () => {
		expect(validateOhlcUnits(frame, spec)).toBeUndefined();
	});

	it("validateOhlcUnits should reject mismatched units", () => {
		const badFrame: DashboardDataFrameV2 = {
			...frame,
			fields: [
				{ key: "time", label: "Time", type: "time", values: [1], roles: ["time"], labels: {} },
				{ key: "open", label: "Open", type: "number", values: [10], roles: ["open"], labels: {}, config: { unit: { kind: "currency", code: "USD" } } },
				{ key: "high", label: "High", type: "number", values: [15], roles: ["high"], labels: {}, config: { unit: { kind: "currency", code: "EUR" } } },
				{ key: "low", label: "Low", type: "number", values: [5], roles: ["low"], labels: {} },
				{ key: "close", label: "Close", type: "number", values: [12], roles: ["close"], labels: {} },
			],
		};
		expect(validateOhlcUnits(badFrame, spec)).toBe("OHLC price fields require identical units");
	});

	describe("resolveTraceDurationMultiplier", () => {
		it("should return error if duration field is missing", () => {
			const emptyFrame: DashboardDataFrameV2 = {
				schemaVersion: 2,
				refId: "A",
				source: { kind: "query", refId: "A" },
				name: "Empty",
				fields: [],
				meta: {},
			};
			expect(resolveTraceDurationMultiplier(emptyFrame, spec)).toEqual({
				error: "Trace duration field is missing",
			});
		});

		it("should return error if unit is not duration", () => {
			const badUnitFrame: DashboardDataFrameV2 = {
				schemaVersion: 2,
				refId: "A",
				source: { kind: "query", refId: "A" },
				name: "BadUnit",
				fields: [
					{ key: "duration", label: "Duration", type: "number", values: [100], roles: ["duration"], labels: {}, config: { unit: { kind: "bytes", base: 1024 } } },
				],
				meta: { shapeHint: "traces" },
			};
			const traceSpec: any = { fieldConfig: {}, overrides: [] };
			expect(resolveTraceDurationMultiplier(badUnitFrame, traceSpec)).toEqual({
				error: "Trace duration requires an explicit duration unit",
			});
		});

		it("should return error if duration unit is unsupported", () => {
			const badDurationFrame: DashboardDataFrameV2 = {
				schemaVersion: 2,
				refId: "A",
				source: { kind: "query", refId: "A" },
				name: "BadDuration",
				fields: [
					{ key: "duration", label: "Duration", type: "number", values: [100], roles: ["duration"], labels: {}, config: { unit: { kind: "duration", unit: "m" as never } } },
				],
				meta: { shapeHint: "traces" },
			};
			const traceSpec: any = { fieldConfig: {}, overrides: [] };
			expect(resolveTraceDurationMultiplier(badDurationFrame, traceSpec)).toEqual({
				error: "Trace duration supports ns, us, ms, or s",
			});
		});

		it("should return multiplier for valid duration units", () => {
			const multipliers = { ns: 1e-6, us: 1e-3, ms: 1, s: 1000 };
			for (const [unit, expected] of Object.entries(multipliers)) {
				const validFrame: DashboardDataFrameV2 = {
					schemaVersion: 2,
					refId: "A",
					source: { kind: "query", refId: "A" },
					name: "Valid",
					fields: [
						{ key: "duration", label: "Duration", type: "number", values: [100], roles: ["duration"], labels: {}, config: { unit: { kind: "duration", unit: unit as "ns" | "us" | "ms" | "s" } } },
					],
					meta: { shapeHint: "traces" },
				};
				const traceSpec: any = { fieldConfig: {}, overrides: [] };
				expect(resolveTraceDurationMultiplier(validFrame, traceSpec)).toEqual({
					multiplier: expected,
				});
			}
		});
	});
});
