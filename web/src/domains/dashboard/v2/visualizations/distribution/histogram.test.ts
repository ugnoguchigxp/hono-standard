import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { describe, expect, it } from "vitest";
import { buildHistogramModel } from "./histogram";

const frame = (
	starts: number[],
	ends: number[],
	counts: number[],
	series?: string[],
): DashboardDataFrameV2 => ({
	schemaVersion: 2,
	refId: "A",
	source: { kind: "query", refId: "A" },
	name: "Histogram",
	meta: { shapeHint: "distribution" },
	fields: [
		{
			key: "start",
			label: "Start",
			type: "number",
			roles: ["bin-start"],
			labels: {},
			values: starts,
		},
		{
			key: "end",
			label: "End",
			type: "number",
			roles: ["bin-end"],
			labels: {},
			values: ends,
		},
		{
			key: "count",
			label: "Count",
			type: "number",
			roles: ["count"],
			labels: {},
			values: counts,
		},
		...(series
			? [
					{
						key: "series",
						label: "Series",
						type: "string" as const,
						roles: ["series" as const],
						labels: {},
						values: series,
					},
				]
			: []),
	],
});

describe("histogram model", () => {
	it("derives aligned series metrics and monotonic cumulative values", () => {
		const model = buildHistogramModel(
			frame([0, 1, 0, 1], [1, 2, 1, 2], [1, 3, 2, 4], ["api", "api", "web", "web"]),
		);
		expect(model.series.map((item) => item.label)).toEqual(["api", "web"]);
		expect(model.rows.map((row) => row.totalCount)).toEqual([3, 7]);
		expect(model.rows.map((row) => row.cumulativeProbability)).toEqual([
			0.3,
			1,
		]);
	});

	it("rejects unsorted and misaligned series boundaries", () => {
		expect(() =>
			buildHistogramModel(frame([1, 0], [2, 1], [1, 1])),
		).toThrow("UNSORTED");
		expect(() =>
			buildHistogramModel(
				frame([0, 1, 0, 2], [1, 2, 2, 3], [1, 1, 1, 1], ["a", "a", "b", "b"]),
			),
		).toThrow("MISALIGNED");
	});
});
