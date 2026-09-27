import { describe, expect, it } from "vitest";
import { MockSignalSimulator } from "@api/modules/observatory/mock/simulator";
import { applySseRecord, summarize } from "./spatial-state";

const engine = () => new MockSignalSimulator({ seed: 42, initialTime: 1_700_000_000_000, instanceId: "00000000-0000-4000-8000-000000000001" });
const record = (event: string, sequence: number, data: unknown) => ({ event, id: `00000000-0000-4000-8000-000000000001:${sequence}`, data: JSON.stringify(data) });

describe("spatial state", () => {
	it("accepts authoritative snapshots and rejects gaps", () => {
		const snapshot = engine().snapshot();
		const initial = applySseRecord(null, record("snapshot", 0, snapshot), true);
		expect(initial?.snapshot.scenario).toBe("normal");
		expect(applySseRecord(initial, record("snapshot", 0, snapshot))).toBe(initial);
		expect(() => applySseRecord(initial, record("snapshot", 2, snapshot))).toThrow("gap");
		expect(() => applySseRecord(initial, { ...record("snapshot", 1, snapshot), id: "00000000-0000-4000-8000-000000000002:1" })).toThrow("instance changed");
	});

	it("keeps node and boundary health counts separate", () => {
		const simulator = engine();
		simulator.setScenario("runtime-degraded");
		const snapshot = simulator.snapshot();
		const summary = summarize(snapshot);
		expect(summary.entityHealth.healthy).toBe(snapshot.entities.length - 1);
		expect(summary.entityHealth.degraded).toBe(1);
		expect(summary.boundaryHealth.degraded).toBe(1);
	});

	it("detects an instance change in heartbeat without changing freshness", () => {
		const snapshot = engine().snapshot();
		const current = applySseRecord(null, record("snapshot", 0, snapshot), true);
		expect(applySseRecord(current, { event: "heartbeat", data: JSON.stringify({ instanceId: snapshot.instanceId }) })).toBe(current);
		expect(() => applySseRecord(current, { event: "heartbeat", data: JSON.stringify({ instanceId: "00000000-0000-4000-8000-000000000002" }) })).toThrow("instance changed");
	});

	it("stores bounded events without changing authoritative task state", () => {
		const snapshot = engine().snapshot();
		let current = applySseRecord(null, record("snapshot", 0, snapshot), true);
		for (let sequence = 1; sequence <= 35; sequence += 1) {
			const event = { schemaVersion: 1, id: `00000000-0000-4000-8000-000000000001:${sequence}`, instanceId: snapshot.instanceId, sequence, timestamp: snapshot.generatedAt, kind: "task.completed", source: "agent-core", severity: "info" };
			current = applySseRecord(current, record("event", sequence, event));
		}
		expect(current?.events).toHaveLength(30);
		expect(current?.snapshot.tasks[0]?.state).toBe(snapshot.tasks[0]?.state);
	});

	it("applies queue telemetry to one pipeline when stage IDs overlap", () => {
		const snapshot = engine().snapshot();
		snapshot.pipelines.push({ ...snapshot.pipelines[0]!, id: "second-pipeline" });
		const current = applySseRecord(null, record("snapshot", 0, snapshot), true);
		const next = applySseRecord(current, record("telemetry", 1, { schemaVersion: 1, metric: "queue-depth", pipelineId: "second-pipeline", targetId: "review-queue", value: 7, observedAt: snapshot.generatedAt }));
		expect(next?.snapshot.pipelines[0]?.stages.find((stage) => stage.id === "review-queue")?.queueDepth).toBe(0);
		expect(next?.snapshot.pipelines[1]?.stages.find((stage) => stage.id === "review-queue")?.queueDepth).toBe(7);
		expect(() => applySseRecord(current, record("telemetry", 1, { schemaVersion: 1, metric: "queue-depth", targetId: "review-queue", value: 7, observedAt: snapshot.generatedAt }))).toThrow();
		expect(() => applySseRecord(current, record("telemetry", 1, { schemaVersion: 1, metric: "activity", targetId: "agent-core", value: 2, observedAt: snapshot.generatedAt }))).toThrow();
	});
});
