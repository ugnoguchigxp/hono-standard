import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { describe, expect, it } from "vitest";
import { resolveFrameTimeRange } from "./time-range";

const frame = (values: Array<number | null>): DashboardDataFrameV2 => ({
	schemaVersion: 2,
	refId: "A",
	source: { kind: "query", refId: "A" },
	name: "States",
	fields: [
		{
			key: "time",
			label: "Time",
			type: "time",
			values,
			roles: ["time"],
			labels: {},
		},
		{
			key: "numeric-state",
			label: "Numeric state",
			type: "number",
			values: [9_999, 10_000, 10_001],
			roles: ["state"],
			labels: {},
		},
	],
	meta: { shapeHint: "state-sample" },
});

describe("resolveFrameTimeRange", () => {
	it("uses a valid query range without scanning frame values", () => {
		expect(resolveFrameTimeRange(frame([10, 20]), { from: 100, to: 200 })).toEqual(
			{ from: 100, to: 200 },
		);
	});
	it("derives a deterministic range from time roles only", () => {
		expect(resolveFrameTimeRange(frame([20, null, 10]), undefined, 5)).toEqual(
			{ from: 10, to: 25 },
		);
	});
	it("uses a stable fallback for empty data and invalid ranges", () => {
		expect(resolveFrameTimeRange(frame([null]), { from: 5, to: 5 }, 0)).toEqual(
			{ from: 0, to: 1 },
		);
	});
});
