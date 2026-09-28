import { MockSignalSimulator } from "@api/modules/observatory/mock/simulator";
import { describe, expect, it } from "vitest";
import { buildSceneModel, entityVisualColor, entityVisualState, healthVisual, orbitalPosition, selectionExists, stateVisual } from "./scene-model";

const snapshot = () => new MockSignalSimulator({ seed: 42, initialTime: 1_700_000_000_000, instanceId: "00000000-0000-4000-8000-000000000001" }).snapshot();

describe("semantic scene model", () => {
	it("maps operating pressure and failures to distinct visual states", () => {
		const source = snapshot();
		const entity = source.entities.find((item) => item.id === "physical-cpu")!;
		const withPressure = (activity: number, health: typeof entity.health = entity.health) =>
			entityVisualState({ ...entity, resourceMetric: undefined, activity, health }, source);
		expect(withPressure(0)).toBe("idle");
		expect(withPressure(0.2)).toBe("processing-light");
		expect(withPressure(0.6)).toBe("processing");
		expect(withPressure(0.8)).toBe("heavy-load");
		expect(withPressure(0.9, "degraded")).toBe("warn");
		expect(withPressure(0.9, "fault")).toBe("danger");
		expect(withPressure(0, "disconnected")).toBe("dead");
		expect(withPressure(0, "stale")).toBe("unknown");
		expect(entityVisualState(entity, { scenario: "recovery", tasks: [{ ...source.tasks[0]!, state: "accepted" }] })).toBe("start-active");
		expect(new Set(Object.values(stateVisual).map((visual) => visual.color)).size).toBe(9);
	});
	it("darkens Processing green continuously as pressure rises", () => {
		const entity = buildSceneModel(snapshot()).entities.find((item) => item.id === "physical-cpu")!;
		const at = (activity: number) => entityVisualColor({ ...entity, resourceMetric: undefined, activity, visualState: "processing" });
		expect(at(0.05)).toBe("#b8f6c5");
		expect(at(0.75)).toBe("#148b49");
		expect(at(0.4)).not.toBe(at(0.05));
		expect(at(0.4)).not.toBe(at(0.75));
	});
	it("keeps positions stable when the server changes array order", () => {
		const first = snapshot();
		const second = { ...first, entities: [...first.entities].reverse(), boundaries: [...first.boundaries].reverse(), tasks: [...first.tasks].reverse() };
		expect(buildSceneModel(second)).toEqual(buildSceneModel(first));
	});

	it("keeps entity and boundary health separate", () => {
		const source = snapshot();
		source.entities[0] = { ...source.entities[0]!, health: "healthy" };
		const boundaryIndex = source.boundaries.findIndex((item) => item.id === "core-runtime");
		source.boundaries[boundaryIndex] = { ...source.boundaries[boundaryIndex]!, health: "degraded" };
		const model = buildSceneModel(source);
		expect(model.entities.find((item) => item.id === "agent-core")?.health).toBe("healthy");
		expect(model.boundaries.find((item) => item.id === "core-runtime")?.health).toBe("degraded");
		expect(healthVisual.degraded.pattern).toBe("dashed");
		expect(healthVisual.disconnected.pattern).toBe("broken");
	});

	it("uses the service symbol from the snapshot and a kind fallback", () => {
		const source = snapshot();
		const memory = source.entities.find((item) => item.id === "memory")!;
		source.entities[source.entities.indexOf(memory)] = { ...memory, symbol: undefined };
		const model = buildSceneModel(source);
		expect(model.entities.find((item) => item.id === "memory")?.symbol).toBe("brain");
		expect(model.entities.find((item) => item.id === "llm")?.symbol).toBe("network");
		expect(model.entities.find((item) => item.id === "world-model")?.symbol).toBe("world");
		expect(model.entities.find((item) => item.id === "asr")?.symbol).toBe("microphone");
	});

	it("uses the pipeline ID to distinguish stages and clears removed selections", () => {
		const source = snapshot();
		source.pipelines.push({ ...source.pipelines[0]!, id: "second-pipeline" });
		const model = buildSceneModel(source);
		expect(model.stages.filter((item) => item.id === "finding")).toHaveLength(2);
		expect(selectionExists(model, { kind: "stage", pipelineId: "second-pipeline", id: "finding" })).toBe(true);
		expect(selectionExists(model, { kind: "stage", pipelineId: "missing", id: "finding" })).toBe(false);
		expect(selectionExists(model, { kind: "entity", id: "missing" })).toBe(false);
	});

	it("assigns another slot when an entity is added", () => {
		const source = snapshot();
		const previous = buildSceneModel(source);
		source.entities.push({ ...source.entities.find((item) => item.id === "runtime")!, id: "zz-runtime" });
		const next = buildSceneModel(source);
		expect(next.entities.find((item) => item.id === "runtime")?.position).toEqual(previous.entities.find((item) => item.id === "runtime")?.position);
		expect(next.entities.find((item) => item.id === "zz-runtime")?.position).not.toEqual(previous.entities.find((item) => item.id === "runtime")?.position);
	});

	it("keeps multiple agents apart throughout their orbits", () => {
		const source = snapshot();
		const agent = source.entities.find((item) => item.kind === "agent")!;
		for (let index = 1; index < 5; index++)
			source.entities.push({ ...agent, id: `agent-extra-${index}` });
		const agents = buildSceneModel(source).entities.filter((item) => item.kind === "agent");
		for (let elapsed = 0; elapsed <= 140_000; elapsed += 5_000) {
			for (let first = 0; first < agents.length; first++) {
				for (let second = first + 1; second < agents.length; second++) {
					const a = orbitalPosition(agents[first]!.orbit, elapsed);
					const b = orbitalPosition(agents[second]!.orbit, elapsed);
					expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeGreaterThanOrEqual(1.5 - 1e-9);
				}
			}
		}
	});

	it("keeps independent queues outside the ordered ContextStill path", () => {
		const model = buildSceneModel(snapshot());
		const pipeline = model.pipelines[0]!;
		expect(pipeline.links).toEqual([
			{ source: "finding", target: "covering" },
			{ source: "covering", target: "finalize" },
		]);
		const steps = model.stages.filter((stage) => stage.kind === "step");
		const queues = model.stages.filter((stage) => stage.kind === "queue");
		expect(steps.map((stage) => stage.id)).toEqual(["finding", "covering", "finalize"]);
		expect(new Set(model.stages.map((stage) => stage.orbit.inclination)).size).toBe(5);
		expect(new Set(model.stages.map((stage) => stage.orbit.nodeAngle)).size).toBe(5);
		expect(model.stages.every((stage) => stage.orbit.radius > 5)).toBe(true);
		expect(model.stages.every((stage) =>
			[0, 0.25, 0.5, 0.75].some((fraction) =>
				Math.abs(orbitalPosition(stage.orbit, stage.orbit.periodMs * fraction)[1] - stage.orbit.yOffset) > 0.1,
			),
		)).toBe(true);
		expect(pipeline.links.every((link) => !queues.some((queue) => queue.id === link.source || queue.id === link.target))).toBe(true);
	});

	it("does not place system, agent, and pipeline entities on top of one another", () => {
		const source = snapshot();
		source.entities.push({ ...source.entities[0]!, id: "system-root", kind: "system" });
		source.entities.push({ ...source.entities[0]!, id: "pipeline-root", kind: "pipeline" });
		const model = buildSceneModel(source);
		const coordinates = model.entities.map((item) => item.position.join(","));
		expect(new Set(coordinates).size).toBe(coordinates.length);
		expect(model.stages[0]?.position).not.toEqual(model.entities.find((item) => item.id === "pipeline-root")?.position);
	});
});
