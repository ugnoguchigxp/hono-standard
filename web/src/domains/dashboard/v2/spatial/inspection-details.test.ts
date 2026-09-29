import { MockSignalSimulator } from "@api/modules/observatory/mock/simulator";
import { describe, expect, it } from "vitest";
import { inspectionDetails } from "./inspection-details";
import { buildSceneModel } from "./scene-model";

const model = () =>
	buildSceneModel(
		new MockSignalSimulator({
			seed: 42,
			initialTime: 1_700_000_000_000,
			instanceId: "00000000-0000-4000-8000-000000000001",
		}).snapshot(),
	);

describe("in-scene inspection details", () => {
	it("includes every host measurement and resource state", () => {
		const scene = model();
		const host = inspectionDetails(scene, { kind: "entity", id: "physical-host" });
		expect(host?.rows.map((row) => row.label)).toEqual(
			expect.arrayContaining(["ID", "Visual state", "Health", "CPU", "Load 1 / 5 / 15 min", "Memory", "Disk", "Last seen"]),
		);
		const load = inspectionDetails(scene, { kind: "entity", id: "physical-load" });
		expect(load?.rows.find((row) => row.label === "Measurement")?.value).toContain("1 / 5 / 15 min");
	});

	it("includes connection, task, pipeline, and stage fields", () => {
		const scene = model();
		const boundary = inspectionDetails(scene, { kind: "boundary", id: "host-cpu" });
		expect(boundary?.rows.map((row) => row.label)).toEqual(expect.arrayContaining(["Source", "Target", "Latency", "Expected interval"]));
		const task = inspectionDetails(scene, { kind: "task", id: scene.tasks[0]!.id });
		expect(task?.rows.map((row) => row.label)).toEqual(expect.arrayContaining(["Current action", "Completed steps", "Updated"]));
		const pipeline = inspectionDetails(scene, { kind: "pipeline", id: scene.pipelines[0]!.id });
		expect(pipeline?.rows.map((row) => row.label)).toContain("Links");
		const stage = inspectionDetails(scene, { kind: "stage", pipelineId: scene.stages[0]!.pipelineId, id: scene.stages[0]!.id });
		expect(stage?.rows.map((row) => row.label)).toEqual(expect.arrayContaining(["Status", "Active task", "Queue depth"]));
	});
});
