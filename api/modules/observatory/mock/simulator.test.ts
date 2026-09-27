import { describe, expect, it } from "vitest";
import { MockSignalSimulator } from "./simulator";

const options = { seed: 42, initialTime: 1_700_000_000_000, instanceId: "00000000-0000-4000-8000-000000000001" };

describe("MockSignalSimulator", () => {
	it("models the stable targets exposed by SAAA self diagnosis", () => {
		const entities = new MockSignalSimulator(options).snapshot().entities;
		expect(entities.map((entity) => [entity.id, entity.diagnosisId])).toEqual([
			["agent-core", undefined], ["runtime", "harness.reachability"],
			["llm", "harness.llm"], ["backchannel", "harness.backchannel"],
			["asr", "harness.asr"], ["tts", "harness.tts"], ["embedding", "harness.embedding"],
			["sqlite", "sqlite"], ["memory", "memory.personal_state"],
			["world-model", "world.status"], ["tool", "tool_selection.catalog"],
			["context-recall", "context_still.recall"], ["context-search", "context_still.search"],
			["physical-host", undefined],
			["physical-cpu", undefined],
			["physical-load", undefined],
			["physical-memory", undefined],
			["physical-disk", undefined],
		]);
	});
	it("gives each PC resource its own health and explicit relationship", () => {
		const engine = new MockSignalSimulator(options);
		engine.setScenario("host-load-spike");
		const snapshot = engine.snapshot();
		const entity = (id: string) => snapshot.entities.find((item) => item.id === id);
		expect(entity("physical-host")?.health).toBe("fault");
		expect(entity("physical-load")?.health).toBe("fault");
		expect(entity("physical-cpu")?.health).toBe("healthy");
		expect(entity("physical-memory")?.health).toBe("healthy");
		expect(entity("physical-load")?.resourceMetric).toMatchObject({ type: "load", value: 18, capacity: 8 });
		expect(snapshot.boundaries.filter((item) => item.id.startsWith("host-") || item.id === "cpu-load").map((item) => [item.source, item.target, item.health])).toContainEqual(["physical-cpu", "physical-load", "healthy"]);
	});
	it("models distinct host pressure patterns and restores normal state", () => {
		const engine = new MockSignalSimulator(options);
		const host = () => engine.snapshot().entities.find((entity) => entity.id === "physical-host");
		expect(host()?.health).toBe("healthy");
		engine.setScenario("host-cpu-saturated");
		expect(host()?.hostMetrics?.cpuUsage).toBeGreaterThan(0.9);
		expect(host()?.health).toBe("degraded");
		engine.setScenario("host-load-spike");
		expect(host()?.hostMetrics?.load1).toBeGreaterThan(2 * 8);
		expect(host()?.health).toBe("fault");
		engine.setScenario("host-memory-pressure");
		expect(host()?.health).toBe("fault");
		engine.setScenario("host-disk-pressure");
		expect(host()?.health).toBe("fault");
		engine.setScenario("host-offline");
		expect(host()?.health).toBe("disconnected");
		engine.setScenario("normal");
		expect(host()?.health).toBe("healthy");
	});
	it("replays the same scenario transitions and event sequence", () => {
		const run = () => {
			const engine = new MockSignalSimulator(options);
			const packets: unknown[] = [];
			const unsubscribe = engine.subscribe((packet) => packets.push(packet));
			engine.advance(2);
			engine.setScenario("task-heavy");
			engine.advance(5);
			unsubscribe();
			return { snapshot: engine.snapshot(), packets };
		};
		expect(run()).toEqual(run());
	});

	it("keeps node and boundary health separate", () => {
		const engine = new MockSignalSimulator(options);
		engine.setScenario("runtime-degraded");
		const snapshot = engine.snapshot();
		expect(snapshot.entities.find((entity) => entity.id === "agent-core")?.health).toBe("healthy");
		expect(snapshot.boundaries.find((boundary) => boundary.id === "core-runtime")?.health).toBe("degraded");
	});

	it("ages observations without losing the SSE channel and recovers", () => {
		const engine = new MockSignalSimulator(options);
		engine.advance(3);
		const taskBeforeLoss = engine.snapshot().tasks;
		const packets: string[] = [];
		const unsubscribe = engine.subscribe((packet) => packets.push(packet.event));
		engine.setScenario("total-signal-loss");
		engine.advance(2);
		expect(engine.snapshot().entities[0]?.health).toBe("stale");
		engine.advance(3);
		expect(engine.snapshot().entities[0]?.health).toBe("disconnected");
		expect(engine.snapshot().tasks).toEqual(taskBeforeLoss);
		expect(packets).not.toContain("telemetry");
		engine.setScenario("recovery");
		expect(engine.snapshot().entities[0]?.health).toBe("healthy");
		expect(packets).toContain("event");
		unsubscribe();
		expect(engine.subscriberCount).toBe(0);
	});

	it("advances task and pipeline states with matching events", () => {
		const engine = new MockSignalSimulator(options);
		const events: string[] = [];
		const movements: Array<[string, string | undefined]> = [];
		engine.subscribe((packet) => { if (packet.event === "event") events.push(packet.data.kind); });
		engine.subscribe((packet) => { if (packet.event === "event" && packet.data.kind === "pipeline.item.moved") movements.push([packet.data.source, packet.data.target]); });
		engine.setScenario("task-heavy");
		engine.advance(5);
		expect(engine.snapshot().tasks).toHaveLength(3);
		expect(engine.snapshot().tasks[0]?.state).toBe("completed");
		expect(events).toContain("task.started");
		expect(events).toContain("task.completed");
		expect(events).toContain("pipeline.item.moved");
		expect(movements).toContainEqual(["finding", "covering"]);
	});

	it("transfers a ContextStill task once per boundary and activates only its current step", () => {
		const engine = new MockSignalSimulator(options);
		const movements: Array<[string, string | undefined, string | undefined]> = [];
		engine.subscribe((packet) => {
			if (packet.event === "event" && packet.data.kind === "pipeline.item.moved")
				movements.push([packet.data.source, packet.data.target, packet.data.taskId]);
		});
		const activeStep = () => engine.snapshot().pipelines[0]?.stages.filter((stage) => stage.kind === "step" && stage.activeTaskId).map((stage) => [stage.id, stage.activeTaskId]);
		expect(activeStep()).toEqual([["finding", "context-task-1"]]);
		engine.advance(3);
		expect(activeStep()).toEqual([["covering", "context-task-1"]]);
		engine.advance(3);
		expect(activeStep()).toEqual([["finalize", "context-task-1"]]);
		engine.advance(3);
		expect(activeStep()).toEqual([["finding", "context-task-2"]]);
		expect(movements).toEqual([
			["finding", "covering", "context-task-1"],
			["covering", "finalize", "context-task-1"],
		]);
		engine.setScenario("total-signal-loss");
		expect(engine.snapshot().pipelines[0]?.stages.every((stage) => stage.activeTaskId === null)).toBe(true);
	});

	it("rejects invalid clocks and tick counts", () => {
		expect(() => new MockSignalSimulator({ seed: -1 })).toThrow(RangeError);
		expect(() => new MockSignalSimulator(options).advance(0)).toThrow(RangeError);
	});

	it("releases a subscriber when the initial delivery throws", () => {
		const engine = new MockSignalSimulator(options);
		expect(() => engine.subscribe(() => { throw new Error("closed"); })).toThrow("closed");
		expect(engine.subscriberCount).toBe(0);
	});
});
