import { describe, expect, it } from "vitest";
import { eventSchema, scenarioSchema, snapshotSchema, telemetrySchema } from ".";
import { MockSignalSimulator } from "../../../api/modules/observatory/mock/simulator";

const snapshot = () => new MockSignalSimulator({ seed: 42, initialTime: 1_700_000_000_000, instanceId: "00000000-0000-4000-8000-000000000001" }).snapshot();

describe("observatory contract", () => {
	it("validates a complete snapshot and rejects unsupported versions", () => {
		expect(snapshotSchema.safeParse(snapshot()).success).toBe(true);
		expect(snapshotSchema.safeParse({ ...snapshot(), schemaVersion: 2 }).success).toBe(false);
		expect(scenarioSchema.safeParse("pipeline-stalled").success).toBe(false);
	});

	it("rejects invalid graph references, duplicate IDs, and invalid metrics", () => {
		const base = snapshot();
		expect(snapshotSchema.safeParse({ ...base, entities: [...base.entities, base.entities[0]] }).success).toBe(false);
		expect(snapshotSchema.safeParse({ ...base, boundaries: [{ ...base.boundaries[0], target: "missing" }] }).success).toBe(false);
		expect(snapshotSchema.safeParse({ ...base, entities: [{ ...base.entities[0], activity: Number.NaN }] }).success).toBe(false);
		expect(snapshotSchema.safeParse({ ...base, pipelines: [{ ...base.pipelines[0], stages: [base.pipelines[0]?.stages[0], base.pipelines[0]?.stages[0]] }] }).success).toBe(false);
		expect(snapshotSchema.safeParse({ ...base, pipelines: [{ ...base.pipelines[0], links: [{ source: "finding", target: "missing" }] }] }).success).toBe(false);
		expect(snapshotSchema.safeParse({ ...base, pipelines: [{ ...base.pipelines[0], links: [{ source: "finding", target: "finding" }] }] }).success).toBe(false);
	});

	it("does not allow rendering attributes or secrets in events", () => {
		const event = { schemaVersion: 1, id: "id", instanceId: "00000000-0000-4000-8000-000000000001", sequence: 1, timestamp: 1, kind: "signal.sent", source: "agent-core", severity: "info" };
		expect(eventSchema.safeParse(event).success).toBe(true);
		expect(eventSchema.safeParse({ ...event, color: "red" }).success).toBe(false);
	});

	it("validates metric units and scopes stage telemetry to a pipeline", () => {
		const base = { schemaVersion: 1, observedAt: 1, targetId: "agent-core" };
		expect(telemetrySchema.safeParse({ ...base, metric: "activity", value: 0.4 }).success).toBe(true);
		expect(telemetrySchema.safeParse({ ...base, metric: "activity", value: 2 }).success).toBe(false);
		expect(telemetrySchema.safeParse({ ...base, metric: "queue-depth", value: 1 }).success).toBe(false);
		expect(telemetrySchema.safeParse({ ...base, metric: "queue-depth", pipelineId: "context-still", value: 1 }).success).toBe(true);
	});
});
