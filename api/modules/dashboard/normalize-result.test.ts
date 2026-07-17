import { describe, expect, it } from "vitest";
import { DashboardNormalizationError, normalizePanelResult } from "./normalize-result";
import { categoryResult, statResult, tableResult, timeSeriesResult } from "./result-builders";

const range = { from: new Date(0), to: new Date(5_000) };

describe("normalizePanelResult", () => {
	it("fills missing timeseries buckets without changing the server range", () => {
		const result = normalizePanelResult({
			data: { kind: "timeseries", series: [{ key: "value", label: "Value" }], rows: [{ time: 0, values: { value: 1 } }, { time: 4_000, values: { value: 4 } }] },
			resolvedRange: range,
			intervalMs: 1_000,
			maxDataPoints: 10,
			fill: "previous",
		});
		expect(result.data.kind).toBe("timeseries");
		if (result.data.kind === "timeseries") expect(result.data.rows.map((row) => row.values.value)).toEqual([1, 1, 1, 1, 4]);
	});

	it("rejects duplicate timestamps, unknown keys, and invalid results", () => {
		const base = { resolvedRange: range, intervalMs: 1_000, maxDataPoints: 10, fill: "null" as const };
		const duplicate = { kind: "timeseries", series: [{ key: "value", label: "Value" }], rows: [
			{ time: 0, values: { value: 1 } },
			{ time: 0, values: { value: 2 } },
		] };
		const unknownKey = { kind: "timeseries", series: [{ key: "value", label: "Value" }], rows: [
			{ time: 0, values: { other: 1 } },
		] };
		expect(() => normalizePanelResult({ ...base, data: duplicate })).toThrow(DashboardNormalizationError);
		expect(() => normalizePanelResult({ ...base, data: unknownKey })).toThrow(/Unknown series/);
		expect(() => normalizePanelResult({ ...base, data: { kind: "unknown" } })).toThrow(/Handler result/);
	});

	it("preserves freshness/partial state and derives stat delta", () => {
		const result = normalizePanelResult({
			data: { kind: "stat", value: 12, previous: 10 },
			state: { partial: true, warnings: ["late shard"], dataThrough: "2026-07-16T01:00:00.000Z", staleAfterMs: 60_000 },
			resolvedRange: range,
			intervalMs: 1_000,
			maxDataPoints: 10,
			fill: "null",
		});
		expect(result.state.partial).toBe(true);
		expect(result.state.staleAfterMs).toBe(60_000);
		expect(result.data).toMatchObject({ kind: "stat", delta: 2 });
	});

	it("rejects partial state without warnings and unknown table columns", () => {
		const base = { resolvedRange: range, intervalMs: 1_000, maxDataPoints: 10, fill: "null" as const };
		expect(() => normalizePanelResult({ ...base, data: { kind: "stat", value: 1 }, state: { partial: true, warnings: [] } })).toThrow(/Handler state/);
		expect(() => normalizePanelResult({ ...base, data: { kind: "table", columns: [{ key: "known", label: "Known" }], rows: [{ unknown: "x" }] }, state: { emptyReason: "no-records" } })).toThrow(/Unknown table column/);
	});
	it("normalizes category, table, empty, and stat boundaries", () => {
		const base = { resolvedRange: range, intervalMs: 1_000, maxDataPoints: 2, fill: "zero" as const };
		const category = normalizePanelResult({ ...base, data: { kind: "category", series: [{ key: "value", label: "Value" }], rows: [{ category: "b", values: { value: 2 } }, { category: "a", values: {} }] } });
		expect(category.data.kind).toBe("category");
		const table = normalizePanelResult({ ...base, data: { kind: "table", columns: [{ key: "value", label: "Value" }], rows: [{ value: 1 }, {}] } });
		expect(table.data.kind).toBe("table");
		const emptyTable = normalizePanelResult({ ...base, data: { kind: "table", columns: [{ key: "value", label: "Value" }], rows: [] }, state: { emptyReason: "no-records" } });
		expect(emptyTable.rowCount).toBe(0);
		const emptyStat = normalizePanelResult({ ...base, data: { kind: "stat", value: null }, state: { emptyReason: "no-records" } });
		expect(emptyStat.rowCount).toBe(0);
		const emptySeries = normalizePanelResult({ ...base, data: { kind: "timeseries", series: [{ key: "value", label: "Value" }], rows: [] }, state: { emptyReason: "no-records" } });
		expect(emptySeries.rowCount).toBe(0);
	});
	it("enforces series and row limits", () => {
		const base = { resolvedRange: range, intervalMs: 1_000, maxDataPoints: 1, fill: "null" as const };
		const tooManySeries = Array.from({ length: 21 }, (_, index) => ({ key: `v${index}`, label: `V${index}` }));
		expect(() => normalizePanelResult({ ...base, data: { kind: "category", series: tooManySeries, rows: [] }, state: { emptyReason: "no-records" } })).toThrow(/series/);
		expect(() => normalizePanelResult({ ...base, data: { kind: "category", series: [{ key: "value", label: "Value" }], rows: [{ category: "a", values: {} }, { category: "b", values: {} }] } })).toThrow(/rows/);
	});
	it("provides typed v1 result builders", () => {
		expect(timeSeriesResult([], []).kind).toBe("timeseries");
		expect(categoryResult([], []).kind).toBe("category");
		expect(statResult(1).kind).toBe("stat");
		expect(tableResult([], []).kind).toBe("table");
	});
});
