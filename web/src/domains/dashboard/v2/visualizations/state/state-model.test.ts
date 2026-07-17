import { describe, expect, it } from "vitest";
import { buildStateIntervals } from "./interval-model";
import { buildStateSamples } from "./sample-model";
import { resolveStateDatum, stateRawIdentity } from "./state-value";
import { buildBucketBoundaries, buildUptimeModel } from "./uptime-model";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";

const frame = (shape: "state-interval" | "state-sample" = "state-interval"): DashboardDataFrameV2 => ({ schemaVersion: 2, refId: "A", source: { kind: "query", refId: "A" }, name: "states", fields: [{ key: "time", label: "Time", type: "time", values: [0, 10, 20], roles: [shape === "state-interval" ? "start-time" : "time"], labels: {} }, { key: "state", label: "State", type: "string", values: ["healthy", "warning", "healthy"], roles: ["state"], labels: {} }, { key: "lane", label: "Lane", type: "string", values: ["api", "api", "api"], roles: ["category"], labels: {} }], meta: { shapeHint: shape } });

describe("state models", () => {
	it("resolves typed state identity and merges only by explicit identity", () => {
		expect(resolveStateDatum("offline").semantic).toBe("unknown");
		expect(stateRawIdentity(1)).not.toBe(stateRawIdentity("1"));
		const model = buildStateIntervals(frame(), { range: { from: 0, to: 30 }, mergeAdjacent: true, mergeBy: "raw" });
		expect(model.intervals).toHaveLength(3);
	});
	it("applies value mappings, thresholds, and null semantics", () => {
		const config = {
			valueMappings: [
				{ kind: "null" as const, text: "missing" },
				{ kind: "value" as const, value: "ok", text: "Operational" },
				{ kind: "range" as const, from: 1, to: 3, text: "Warning", colorToken: "--state-warning" },
			],
			thresholds: {
				mode: "absolute" as const,
				steps: [
					{ value: null, colorToken: "--state-muted", label: "Unknown" },
					{ value: 10, colorToken: "--state-healthy", label: "Healthy" },
				],
			},
		};
		expect(resolveStateDatum(null, config)).toMatchObject({ text: "missing", semantic: "unknown" });
		expect(resolveStateDatum("ok", config).semantic).toBe("healthy");
		expect(resolveStateDatum(2, config).colorToken).toBe("--state-warning");
		expect(resolveStateDatum(12, config).text).toBe("Healthy");
		expect(resolveStateDatum(4, config).semantic).toBe("unknown");
	});
	it("rejects unsorted/overlapping intervals and synthesizes cadence gaps", () => {
		const unsorted = { ...frame(), fields: frame().fields.map((field) => field.key === "time" ? { ...field, values: [10, 0, 20] } : field) } as DashboardDataFrameV2;
		expect(() => buildStateIntervals(unsorted, { range: { from: 0, to: 30 } })).toThrow(/UNSORTED/);
		const sample = buildStateSamples(frame("state-sample"), { expectedCadenceMs: 10 });
		expect(sample.columns).toEqual([0, 10, 20]);
	});
	it("aggregates uptime with observed coverage denominator", () => {
		const result = buildUptimeModel({ frame: frame("state-sample"), range: { from: 0, to: 30 }, timezone: "UTC", bucket: "hour", expectedCadenceMs: 10, minimumCoveragePercent: 0 });
		expect(result.buckets[0]?.observedMs).toBe(30);
		expect(result.buckets[0]?.uptimeRatio).toBeCloseTo(2 / 3);
	});
	it("preserves 23-hour and 25-hour local days", () => {
		const spring = buildBucketBoundaries({ from: Date.UTC(2026, 2, 8, 5), to: Date.UTC(2026, 2, 9, 4) }, "day", "America/New_York");
		const autumn = buildBucketBoundaries({ from: Date.UTC(2026, 10, 1, 4), to: Date.UTC(2026, 10, 2, 5) }, "day", "America/New_York");
		const springStart = spring[0];
		const springEnd = spring[1];
		const autumnStart = autumn[0];
		const autumnEnd = autumn[1];
		if (springStart === undefined || springEnd === undefined || autumnStart === undefined || autumnEnd === undefined) throw new Error("DST fixture did not produce a bucket");
		expect(springEnd - springStart).toBe(23 * 60 * 60 * 1000);
		expect(autumnEnd - autumnStart).toBe(25 * 60 * 60 * 1000);
	});
	it("merges adjacent intervals per lane and rejects off-range overlap", () => {
		const interleaved = {
			...frame(),
			fields: frame().fields.map((field) =>
				field.key === "time"
					? { ...field, values: [0, 0, 10, 10] }
					: field.key === "state"
						? { ...field, values: ["healthy", "healthy", "healthy", "healthy"] }
						: { ...field, values: ["api", "web", "api", "web"] },
			),
		} as DashboardDataFrameV2;
		const merged = buildStateIntervals(interleaved, {
			range: { from: 0, to: 20 },
			mergeAdjacent: true,
		});
		expect(merged.intervals).toHaveLength(2);
		expect(merged.intervals.every((item) => item.openEnded)).toBe(true);

		const overlapping = {
			...frame(),
			fields: [
				{ ...frame().fields[0]!, values: [0, 5] },
				{ key: "end", label: "End", type: "time" as const, values: [10, 15], roles: ["end-time" as const], labels: {} },
				{ ...frame().fields[1]!, values: ["healthy", "warning"] },
				{ ...frame().fields[2]!, values: ["api", "api"] },
			],
		} as DashboardDataFrameV2;
		expect(() =>
			buildStateIntervals(overlapping, { range: { from: 100, to: 200 } }),
		).toThrow("STATE_INTERVAL_OVERLAP");
	});
	it("validates raw sample order before clipping and fills cadence holes", () => {
		const unsortedOutsideRange = {
			...frame("state-sample"),
			fields: frame("state-sample").fields.map((field) =>
				field.key === "time"
					? { ...field, values: [0, 100, 50] }
					: field,
			),
		} as DashboardDataFrameV2;
		expect(() =>
			buildStateSamples(unsortedOutsideRange, { range: { from: 0, to: 10 } }),
		).toThrow("STATE_SAMPLE_UNSORTED");

		const sparse = {
			...frame("state-sample"),
			fields: frame("state-sample").fields.map((field) =>
				field.key === "time"
					? { ...field, values: [0, 30] }
					: field.key === "state"
						? { ...field, values: ["healthy", "healthy"] }
						: { ...field, values: ["api", "api"] },
			),
		} as DashboardDataFrameV2;
		const samples = buildStateSamples(sparse, {
			expectedCadenceMs: 10,
			cadenceTolerancePercent: 10,
		});
		expect(samples.samples.filter((item) => item.synthetic).map((item) => item.time)).toEqual([10, 20]);
		const uptime = buildUptimeModel({
			frame: sparse,
			range: { from: 0, to: 40 },
			timezone: "UTC",
			bucket: "hour",
			expectedCadenceMs: 10,
			minimumCoveragePercent: 0,
		});
		expect(uptime.buckets[0]?.observedMs).toBe(20);
		expect(uptime.buckets[0]?.missingMs).toBe(20);
	});
	it("emits every repeated local hour during the autumn DST transition", () => {
		const range = {
			from: Date.UTC(2026, 10, 1, 4),
			to: Date.UTC(2026, 10, 2, 5),
		};
		expect(buildBucketBoundaries(range, "hour", "America/New_York")).toHaveLength(26);
	});
	it("rejects rendered cell counts above the hard limits", () => {
		const rows = Array.from({ length: 50 }, (_, lane) => [
			{ lane: `lane-${lane}`, time: lane * 2 },
			{ lane: `lane-${lane}`, time: lane * 2 + 1 },
		]).flat();
		rows.splice(2, 0, { lane: "lane-0", time: 100 });
		const cells = {
			...frame("state-sample"),
			fields: [
				{ ...frame("state-sample").fields[0]!, values: rows.map((row) => row.time) },
				{ ...frame("state-sample").fields[1]!, values: rows.map(() => "healthy") },
				{ ...frame("state-sample").fields[2]!, values: rows.map((row) => row.lane) },
			],
		} as DashboardDataFrameV2;
		expect(() => buildStateSamples(cells)).toThrow("STATE_CELL_LIMIT");

		const longRange = 700 * 60 * 60 * 1000;
		const intervals = Array.from({ length: 8 }, (_, lane) => ({
			id: String(lane),
			laneId: `lane-${lane}`,
			laneLabel: `Lane ${lane}`,
			start: 0,
			end: longRange,
			state: { raw: "healthy" as const, text: "healthy", semantic: "healthy" as const, colorToken: "--color-chart-success" },
			durationMs: longRange,
			openEnded: false,
		}));
		expect(() =>
			buildUptimeModel({ intervals, range: { from: 0, to: longRange }, timezone: "UTC", bucket: "hour" }),
		).toThrow("UPTIME_CELL_LIMIT");
	});
});
