import { MockSignalSimulator } from "@api/modules/observatory/mock/simulator";
import { describe, expect, it } from "vitest";
import { applySseRecord, type SpatialData } from "./spatial-state";

const instanceId = "00000000-0000-4000-8000-000000000001";
const snapshot = () =>
	new MockSignalSimulator({
		seed: 42,
		initialTime: 1_700_000_000_000,
		instanceId,
	}).snapshot();
const record = (event: string, sequence: number | string, data: unknown) => ({
	event,
	id: `${instanceId}:${sequence}`,
	data: JSON.stringify(data),
});
const initial = () =>
	applySseRecord(null, record("snapshot", 0, snapshot()), true) as SpatialData;
const telemetry = (data: Record<string, unknown>) =>
	record("telemetry", 1, {
		schemaVersion: 1,
		observedAt: initial().snapshot.generatedAt,
		...data,
	});

describe("spatial state edge cases", () => {
	it("ignores heartbeats before the first snapshot", () => {
		const heartbeat = { event: "heartbeat", data: "{}" };
		expect(applySseRecord(null, heartbeat)).toBeNull();
		const current = initial();
		expect(applySseRecord(current, heartbeat, true)).toBe(current);
	});

	it("rejects malformed stream IDs and ordering", () => {
		expect(() =>
			applySseRecord(null, { event: "snapshot", data: "{}" }, true),
		).toThrow("Invalid observatory stream ID");
		expect(() =>
			applySseRecord(null, record("snapshot", "99999999999999999999", {}), true),
		).toThrow("Invalid observatory sequence");
		expect(() =>
			applySseRecord(null, record("event", 0, {}), true),
		).toThrow("Expected observatory snapshot");
		expect(() =>
			applySseRecord(
				null,
				{ ...record("snapshot", 0, snapshot()), id: `${"1".repeat(8)}-0000-4000-8000-000000000001:0` },
				true,
			),
		).toThrow("Snapshot instance mismatch");
		expect(() => applySseRecord(null, record("event", 1, {}))).toThrow(
			"Missing observatory snapshot",
		);
		expect(() => applySseRecord(initial(), record("unknown", 1, {}))).toThrow(
			"Unknown observatory stream event",
		);
	});

	it("accepts newer snapshots and rejects older revisions", () => {
		const current = initial();
		const next = { ...current.snapshot, revision: current.snapshot.revision + 1 };
		expect(
			applySseRecord(current, record("snapshot", 1, next))?.snapshot.revision,
		).toBe(next.revision);
		expect(() =>
			applySseRecord(
				{ ...current, snapshot: next },
				record("snapshot", 1, current.snapshot),
			),
		).toThrow("Invalid observatory revision");
	});

	it("rejects events whose payload does not match the stream ID", () => {
		const current = initial();
		const event = {
			schemaVersion: 1,
			id: `${instanceId}:2`,
			instanceId,
			sequence: 2,
			timestamp: current.snapshot.generatedAt,
			kind: "task.completed",
			source: "agent-core",
			severity: "info",
		};
		expect(() => applySseRecord(current, record("event", 1, event))).toThrow(
			"Event ID mismatch",
		);
	});

	it("applies activity and latency telemetry to known targets", () => {
		const current = initial();
		const entity = current.snapshot.entities[0]!;
		const boundary = current.snapshot.boundaries[0]!;
		const activity = applySseRecord(
			current,
			telemetry({ metric: "activity", targetId: entity.id, value: 0.5 }),
		);
		expect(
			activity?.snapshot.entities.find((item) => item.id === entity.id)
				?.activity,
		).toBe(0.5);
		const latency = applySseRecord(
			current,
			telemetry({ metric: "latency-ms", targetId: boundary.id, value: 42 }),
		);
		expect(
			latency?.snapshot.boundaries.find((item) => item.id === boundary.id)
				?.latencyMs,
		).toBe(42);
	});

	it("rejects telemetry for unknown targets", () => {
		const current = initial();
		for (const metric of ["activity", "latency-ms"])
			expect(() =>
				applySseRecord(
					current,
					telemetry({ metric, targetId: "missing", value: 0.1 }),
				),
			).toThrow("Unknown observatory telemetry target");
		expect(() =>
			applySseRecord(
				current,
				telemetry({
					metric: "queue-depth",
					pipelineId: current.snapshot.pipelines[0]!.id,
					targetId: "missing",
					value: 1,
				}),
			),
		).toThrow("Unknown observatory telemetry target");
	});
});
