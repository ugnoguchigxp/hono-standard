import { describe, expect, it } from "vitest";
import {
	DashboardRecordAdapterError,
	recordsToDataFrameV2,
} from "./record-adapter";

describe("recordsToDataFrameV2", () => {
	it("converts explicit columns in stable order without exposing extra properties", () => {
		const source = [
			{
				at: new Date("2026-07-18T00:00:00.000Z"),
				value: 3,
				ok: true,
				secret: "do-not-export",
			},
		];
		const result = recordsToDataFrameV2({
			records: source,
			refId: "A",
			name: "Records",
			outputShape: "timeseries",
			columns: [
				{ source: "at", type: "time", roles: ["time"] },
				{ source: "value", type: "number", roles: ["value"] },
				{ source: "ok", type: "boolean" },
			],
		});

		expect(result.frame.fields.map((field) => field.key)).toEqual([
			"at",
			"value",
			"ok",
		]);
		expect(result.frame.fields[0]?.values).toEqual([1784332800000]);
		expect(JSON.stringify(result.frame)).not.toContain("do-not-export");
		expect(source[0]?.at).toBeInstanceOf(Date);
	});

	it("supports null and explicit accessor conversion", () => {
		const result = recordsToDataFrameV2({
			records: [{ iso: "2026-07-18T00:00:00.000Z", value: null }],
			refId: "A",
			name: "Accessor",
			outputShape: "timeseries",
			columns: [
				{
					key: "at",
					accessor: (row) => new Date(row.iso),
					type: "time",
					roles: ["time"],
				},
				{ source: "value", type: "number", roles: ["value"] },
			],
		});
		expect(result.frame.fields.map((field) => field.values)).toEqual([
			[1784332800000],
			[null],
		]);
	});

	it.each([
		[{ value: undefined }, "number"],
		[{ value: Number.NaN }, "number"],
		[{ value: Number.POSITIVE_INFINITY }, "number"],
		[{ value: 1n }, "number"],
		[{ value: {} }, "string"],
		[{ value: [] }, "string"],
		[{ value: new Date("invalid") }, "time"],
		[{ value: "2026-07-18T00:00:00Z" }, "time"],
	] as const)("rejects invalid physical values %#", (row, type) => {
		expect(() =>
			recordsToDataFrameV2({
				records: [row],
				refId: "A",
				name: "Invalid",
				columns: [{ source: "value", type }],
			}),
		).toThrow(DashboardRecordAdapterError);
	});

	it("rejects missing sources and accessor failures without exposing values", () => {
		let error: unknown;
		try {
			recordsToDataFrameV2({
				records: [{ value: "sensitive-value" }],
				refId: "A",
				name: "Invalid",
				columns: [
					{
						key: "value",
						accessor: () => {
							throw new Error("access failed");
						},
						type: "string",
					},
				],
			});
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(DashboardRecordAdapterError);
		expect(String(error)).not.toContain("sensitive-value");

		expect(() =>
			recordsToDataFrameV2({
				records: [{}] as Array<{ value?: number }>,
				refId: "A",
				name: "Missing",
				columns: [{ source: "value", type: "number" }],
			}),
		).toThrow(DashboardRecordAdapterError);
	});

	it("preserves empty metadata and validates non-empty shapes", () => {
		const empty = recordsToDataFrameV2({
			records: [] as Array<{ at: Date; value: number }>,
			refId: "A",
			name: "Empty",
			outputShape: "timeseries",
			columns: [
				{ source: "at", type: "time", roles: ["time"] },
				{ source: "value", type: "number", roles: ["value"] },
			],
		});
		expect(empty.frame.fields.every((field) => field.values.length === 0)).toBe(
			true,
		);

		expect(() =>
			recordsToDataFrameV2({
				records: [] as Array<{ value: number }>,
				refId: "A",
				name: "Empty mismatch",
				outputShape: "timeseries",
				columns: [{ source: "value", type: "number", roles: ["value"] }],
			}),
		).toThrow(DashboardRecordAdapterError);

		expect(() =>
			recordsToDataFrameV2({
				records: [{ value: 1 }],
				refId: "A",
				name: "Mismatch",
				outputShape: "timeseries",
				columns: [{ source: "value", type: "number", roles: ["value"] }],
			}),
		).toThrow(DashboardRecordAdapterError);
	});

	it("requires explicit truncate and attaches a notice", () => {
		const records = [{ value: 1 }, { value: 2 }];
		expect(() =>
			recordsToDataFrameV2({
				records,
				refId: "A",
				name: "Limit",
				columns: [{ source: "value", type: "number" }],
				maxRows: 1,
			}),
		).toThrow(DashboardRecordAdapterError);

		const result = recordsToDataFrameV2({
			records,
			refId: "A",
			name: "Limit",
			columns: [{ source: "value", type: "number" }],
			maxRows: 1,
			overflow: "truncate",
		});
		expect(result.frame.fields[0]?.values).toEqual([1]);
		expect(result.state).toMatchObject({
			truncated: true,
			notices: [{ code: "DATA_TRUNCATED", frameRefId: "A" }],
		});
	});

	it("clones column metadata", () => {
		const labels = { unit: "requests" };
		const result = recordsToDataFrameV2({
			records: [{ value: 1 }],
			refId: "A",
			name: "Metadata",
			columns: [
				{
					source: "value",
					type: "number",
					labels,
					config: { unit: { kind: "short" } },
				},
			],
		});
		labels.unit = "changed";
		expect(result.frame.fields[0]?.labels).toEqual({ unit: "requests" });
	});
});
