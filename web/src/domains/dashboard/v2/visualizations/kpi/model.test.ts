import { dashboardDataFrameV2Schema, standardFieldConfigV2Schema } from "@shared/schemas/dashboard.schema";
import { describe, expect, it } from "vitest";
import { buildKpiListModel, buildKpiModel } from "./model";

const frame = dashboardDataFrameV2Schema.parse({ schemaVersion: 2, refId: "A", source: { kind: "query", refId: "A" }, name: "KPI", fields: [
	{ key: "value", label: "Current", type: "number", values: [null, 72], roles: ["value"], labels: {} },
	{ key: "previous", label: "Previous", type: "number", values: [null, 80], roles: ["previous"], labels: {} },
	{ key: "goal", label: "Goal", type: "number", values: [null, 75], roles: ["goal"], labels: {} },
], meta: { shapeHint: "scalar" } });

describe("KPI model", () => {
	it("resolves role fields, previous, goal, and non-clamped range", () => {
		const result = buildKpiModel([frame], { range: { min: "config", max: "config", overflow: "show-marker" }, fieldConfig: { ...standardFieldConfigV2Schema.parse({}), min: 0, max: 70 } });
		expect(result.items[0]).toMatchObject({ current: 72, previous: 80, goal: 75, delta: -8, overflow: "above" });
	});
	it("creates stable category IDs without changing input order", () => {
		const category = dashboardDataFrameV2Schema.parse({ ...frame, meta: { shapeHint: "category" }, fields: [
			{ key: "service", label: "Service", type: "string", values: ["api", "web"], roles: ["category"], labels: {} },
			{ key: "value", label: "Value", type: "number", values: [1, 2], roles: ["value"], labels: {} },
			{ key: "previous", label: "Previous", type: "number", values: [0.5, 1.5], roles: ["previous"], labels: {} },
			{ key: "goal", label: "Goal", type: "number", values: [3, 4], roles: ["goal"], labels: {} },
		] });
		const result = buildKpiListModel([category], { fieldConfig: standardFieldConfigV2Schema.parse({}) });
		expect(result.items.map((item) => item.id)).toEqual(["A:value:api", "A:value:web"]);
		expect(result.items.map((item) => item.previous)).toEqual([0.5, 1.5]);
		expect(result.items.map((item) => item.goal)).toEqual([3, 4]);
	});
	it("rejects ambiguous value roles instead of silently choosing a field", () => {
		const ambiguous = dashboardDataFrameV2Schema.parse({
			...frame,
			fields: [
				{ key: "a", label: "A", type: "number", values: [1], roles: ["value"], labels: {} },
				{ key: "b", label: "B", type: "number", values: [2], roles: ["value"], labels: {} },
			],
		});
		expect(buildKpiModel([ambiguous], {}).error).toMatch(/ambiguous/);
	});
	it("uses the previous non-null time point and keeps sliced sparkline alignment", () => {
		const timeseries = dashboardDataFrameV2Schema.parse({
			...frame,
			fields: [
				{ key: "time", label: "Time", type: "time", values: [100, 200, 300], roles: ["time"], labels: {} },
				{ key: "value", label: "Current", type: "number", values: [10, null, 30], roles: ["value"], labels: {} },
			],
			meta: { shapeHint: "timeseries" },
		});
		const result = buildKpiModel([timeseries], { maxPoints: 2, reduce: "last-not-null", fieldConfig: standardFieldConfigV2Schema.parse({}) });
		expect(result.items[0]).toMatchObject({ current: 30, previous: 10, delta: 20 });
		expect(result.items[0]?.sparkline).toEqual([
			{ time: 200, value: null },
			{ time: 300, value: 30 },
		]);
	});
	it("formats percent and percentage-point deltas without double scaling", () => {
		const percentConfig = standardFieldConfigV2Schema.parse({
			unit: { kind: "percent", scale: "unit" },
			decimals: 1,
		});
		const percentFrame = dashboardDataFrameV2Schema.parse({
			...frame,
			fields: [
				{ key: "value", label: "Current", type: "number", values: [0.24], roles: ["value"], labels: {} },
				{ key: "previous", label: "Previous", type: "number", values: [0.2], roles: ["previous"], labels: {} },
			],
		});
		expect(
			buildKpiModel([percentFrame], {
				delta: { mode: "percent", sentiment: "neutral", zeroTolerance: 0 },
				fieldConfig: percentConfig,
			}).items[0]?.formatted.delta,
		).toBe("20%");
		expect(
			buildKpiModel([percentFrame], {
				delta: {
					mode: "percent-points",
					sentiment: "neutral",
					zeroTolerance: 0,
				},
				fieldConfig: percentConfig,
			}).items[0]?.formatted.delta,
		).toBe("4 pp");
	});
});
