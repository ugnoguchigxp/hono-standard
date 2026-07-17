import { histogramTransformationConfigV1Schema } from "@shared/schemas/dashboard/histogram-transformation.schema";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { describe, expect, it } from "vitest";
import { transformHistogram } from "./core-histogram";

const frame = (
	values: Array<number | null>,
	series?: string[],
): DashboardDataFrameV2 => ({
	schemaVersion: 2,
	refId: "A",
	source: { kind: "query", refId: "A" },
	name: "Values",
	meta: { shapeHint: "distribution" },
	fields: [
		{
			key: "value",
			label: "Value",
			type: "number",
			roles: ["value"],
			labels: {},
			values,
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

const counts = (result: ReturnType<typeof transformHistogram>) =>
	result.fields[2]?.values.reduce<number>(
		(sum, value) => sum + Number(value),
		0,
	) ?? 0;

describe("core histogram transformation", () => {
	it("conserves values and includes the right edge in the final bin", () => {
		const result = transformHistogram(
			frame([0, 1, 2, 3]),
			histogramTransformationConfigV1Schema.parse({
				binning: { mode: "fixed-count", count: 2 },
			}),
		);
		expect(counts(result)).toBe(4);
		expect(result.fields[0]?.values).toEqual([0, 1.5]);
	});

	it("uses common boundaries for every series", () => {
		const result = transformHistogram(
			frame([0, 1, 10, 11], ["low", "low", "high", "high"]),
			histogramTransformationConfigV1Schema.parse({
				binning: { mode: "sturges" },
			}),
		);
		const starts = result.fields[0]?.values ?? [];
		const outputSeries = result.fields[3]?.values ?? [];
		const low = starts.filter((_, index) => outputSeries[index] === "low");
		const high = starts.filter((_, index) => outputSeries[index] === "high");
		expect(low).toEqual(high);
		expect(counts(result)).toBe(4);
	});

	it("uses the Freedman–Diaconis fallback for zero IQR", () => {
		const result = transformHistogram(
			frame([1, 1, 1, 1]),
			histogramTransformationConfigV1Schema.parse({
				binning: { mode: "freedman-diaconis", fallbackCount: 4 },
			}),
		);
		expect(counts(result)).toBe(4);
	});

	it("rejects values outside an explicit range unless overflow is requested", () => {
		const base = {
			binning: { mode: "fixed-width" as const, width: 2, origin: 1 },
			range: { min: 0, max: 2 },
		};
		expect(() =>
			transformHistogram(
				frame([-1, 0, 1, 3]),
				histogramTransformationConfigV1Schema.parse(base),
			),
		).toThrow("OUT_OF_RANGE");
		const result = transformHistogram(
			frame([-1, 0, 1, 3]),
			histogramTransformationConfigV1Schema.parse({
				...base,
				includeOutOfRange: true,
			}),
		);
		expect(counts(result)).toBe(4);
		expect(result.fields[0]?.values).toEqual([-2, 0, 1, 2]);
	});

	it("rejects more than 2,000 accepted values", () => {
		expect(() =>
			transformHistogram(
				frame(Array.from({ length: 2_001 }, (_, index) => index)),
				histogramTransformationConfigV1Schema.parse({}),
			),
		).toThrow("VALUE_LIMIT");
	});
});
