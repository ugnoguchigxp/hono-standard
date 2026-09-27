import { MockSignalSimulator } from "@api/modules/observatory/mock/simulator";
import { describe, expect, it } from "vitest";
import { buildSceneModel, selectionExists } from "./scene-model";

const snapshot = () =>
	new MockSignalSimulator({
		seed: 42,
		initialTime: 1_700_000_000_000,
		instanceId: "00000000-0000-4000-8000-000000000001",
	}).snapshot();

describe("scene model edge cases", () => {
	it("anchors boundaries with unknown endpoints at the origin", () => {
		const source = snapshot();
		source.boundaries[0] = {
			...source.boundaries[0]!,
			source: "missing-a",
			target: "missing-b",
		};
		const boundary = buildSceneModel(source).boundaries.find(
			(item) => item.id === source.boundaries[0]!.id,
		);
		expect(boundary?.from).toEqual([0, 0, 0]);
		expect(boundary?.to).toEqual([0, 0, 0]);
		expect(boundary?.fromOrbit.inclination).toBe(0);
	});

	it("checks every selection kind", () => {
		const model = buildSceneModel(snapshot());
		const stage = model.stages[0]!;
		expect(selectionExists(model, null)).toBe(false);
		expect(
			selectionExists(model, {
				kind: "stage",
				id: stage.id,
				pipelineId: stage.pipelineId,
			}),
		).toBe(true);
		expect(
			selectionExists(model, { kind: "stage", id: stage.id, pipelineId: "x" }),
		).toBe(false);
		for (const kind of ["entity", "boundary", "task", "pipeline"] as const)
			expect(selectionExists(model, { kind, id: "missing" })).toBe(false);
	});
});
