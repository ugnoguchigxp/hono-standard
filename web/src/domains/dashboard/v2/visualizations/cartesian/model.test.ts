import { describe, expect, it } from "vitest";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import {
	buildCartesianModel,
	buildRangeBandRows,
	buildWaterfallRows,
	normalizePercentRows,
	resolveCartesianSeriesKey,
} from "./model";

const frame = (refId: "A" | "B", times: number[], values: Array<number | null>, key = "value"): DashboardDataFrameV2 => ({
	schemaVersion: 2,
	refId,
	source: { kind: "query", refId },
	name: refId,
	fields: [
		{ key: "time", label: "Time", type: "time", roles: ["time"], labels: {}, values: times },
		{ key, label: key, type: "number", roles: ["value"], labels: {}, values },
	],
	meta: { shapeHint: "timeseries" },
});

describe("Cartesian model", () => {
	it("aligns disjoint, out-of-order multi-frame timestamps without mutation", () => {
		const a = frame("A", [2, 1], [20, 10]);
		const b = frame("B", [3], [30]);
		const model = buildCartesianModel([a, b], "time");
		expect(model.rows.map((row) => row.domain)).toEqual([1, 2, 3]);
		expect(model.series[0]?.values).toEqual([10, 20, null]);
		expect(model.series[1]?.values).toEqual([null, null, 30]);
		expect(model.rows.map((row) => row.raw)).toEqual([
			{ "A:time": 1, "A:value": 10 },
			{ "A:time": 2, "A:value": 20 },
			{ "B:time": 3, "B:value": 30 },
		]);
		expect(a.fields[0]?.values).toEqual([2, 1]);
	});
	it("normalizes percent rows, range bands and waterfall rows", () => {
		const primary = frame("A", [1, 2], [10, 20], "lower");
		primary.fields.push({ key: "upper", label: "upper", type: "number", roles: ["value"], labels: {}, values: [30, 20] });
		const model = buildCartesianModel([primary], "time");
		const percent = normalizePercentRows(model);
		expect(percent[0]?.values).toEqual({ lower: 25, upper: 75 });
		expect(normalizePercentRows(model, ["lower"])[0]?.values).toEqual({
			lower: 100,
			upper: 30,
		});
		const range = buildRangeBandRows(model, "lower", "upper");
		expect(range[0]?.width).toBe(20);
		const waterfall = buildWaterfallRows(model, "lower", true);
		expect(waterfall.map((row) => row.end)).toEqual([10, 30, 30]);
		expect(waterfall.map((row) => row.range)).toEqual([[0, 10], [10, 30], [0, 30]]);
		expect(waterfall.map((row) => row.state)).toEqual(["positive", "positive", "total"]);
		expect(waterfall.at(-1)?.synthetic).toBe(true);
	});
	it("applies effective field config once and rejects ambiguous bindings", () => {
		const a = frame("A", [1], [1]);
		const b = frame("B", [1], [2]);
		let resolutions = 0;
		const model = buildCartesianModel([a, b], "time", {
			resolveFieldConfig: (_frame, field) => {
				resolutions += 1;
				return {
					unit: { kind: "none" },
					decimals: 0,
					noValueText: "N/A",
					textAlign: "auto",
					valueMappings: [],
					links: [],
					displayName: `Effective ${field.label}`,
				};
			},
		});
		expect(resolutions).toBe(2);
		expect(model.series[0]?.label).toBe("Effective value");
		expect(resolveCartesianSeriesKey(model, "A:value")).toBe("A:value");
		expect(() => resolveCartesianSeriesKey(model, "value")).toThrow(/AMBIGUOUS/);
	});
	it("rejects duplicate domains even when a frame has multiple series", () => {
		expect(() => buildCartesianModel([frame("A", [1, 1], [1, 2])], "time")).toThrow(
			/DUPLICATE/,
		);
	});
});
