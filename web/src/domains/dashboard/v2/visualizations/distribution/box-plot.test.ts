import { boxPlotConfigV1Schema } from "@shared/schemas/dashboard/distribution-visualizations.schema";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { describe, expect, it } from "vitest";
import { buildBoxDatum, buildBoxPlotModel, stableJitter } from "./box-plot";

const summaryFrame = (categories: string[]): DashboardDataFrameV2 => ({
	schemaVersion: 2,
	refId: "A",
	source: { kind: "query", refId: "A" },
	name: "Summary",
	meta: { shapeHint: "category" },
	fields: [
		{
			key: "category",
			label: "Category",
			type: "string",
			roles: ["category"],
			labels: {},
			values: categories,
		},
		...(["min", "q1", "median", "q3", "max"] as const).map(
			(role, index) => ({
				key: role,
				label: role,
				type: "number" as const,
				roles: [role],
				labels: {},
				values: categories.map(() => index + 1),
			}),
		),
	],
});

describe("box plot model", () => {
	it("uses R-7 quartiles and Tukey outliers", () => {
		const box = buildBoxDatum([1, 2, 3, 4, 5, 100], "API");
		expect(box.q1).toBe(2.25);
		expect(box.median).toBe(3.5);
		expect(box.outliers).toEqual([100]);
	});

	it("keeps point jitter deterministic", () => {
		expect(stableJitter("a", 1, 0.2)).toBe(stableJitter("a", 1, 0.2));
	});
	it("keeps quartiles and means finite for large opposite values", () => {
		const box = buildBoxDatum([-1e308, 1e308], "Range");
		expect(box.median).toBe(0);
		expect(box.mean).toBe(0);
	});

	it("rejects duplicate summary groups", () => {
		expect(() =>
			buildBoxPlotModel(
				[summaryFrame(["API", "API"])],
				boxPlotConfigV1Schema.parse({}),
				"vertical",
			),
		).toThrow("DUPLICATE");
	});
});
