import { describe, expect, it } from "vitest";
import { resolveBrainConfig } from "./core/config";
import { Network, createNeuron } from "./core/network";
import { createExperiment } from "./experiment/experiment";
import { applyAction } from "./environment/interaction";
import { createWorld } from "./environment/world";
import { createBody } from "./organism/body-state";
import { Recorder } from "./observation/recorder";
import { createSnapshot } from "./observation/snapshot";
import { createTelemetry } from "./observation/telemetry";
import { updateStructure } from "./plasticity/structural-plasticity";
import { Mulberry32 } from "./runtime/random";

describe("brain environment and observation", () => {
	it("applies physical actions and preserves body bounds", () => {
		const world = createWorld(new Mulberry32(3), 3, 3);
		world.agent.x = 1;
		world.agent.y = 1;
		world.agent.direction = 0;
		world.entities.food = [{ x: 1, y: 1 }];
		world.entities.shelter = [{ x: 1, y: 1 }];
		world.entities.mate = [{ x: 1, y: 1 }];
		const body = createBody({ fatigue: 0.8, matingDrive: 0.8 });
		expect(applyAction(world, body, "eat", 0).succeeded).toBe(true);
		expect(applyAction(world, body, "rest", 0).succeeded).toBe(true);
		expect(applyAction(world, body, "mate", 0).succeeded).toBe(true);
		expect(applyAction(world, body, "mate", 10).succeeded).toBe(false);
		expect(applyAction(world, body, "turn_right", 10).succeeded).toBe(true);
		expect(applyAction(world, body, "move_forward", 10).succeeded).toBe(true);
		for (const value of [
			body.energy,
			body.hunger,
			body.fatigue,
			body.matingDrive,
		])
			expect(value).toBeGreaterThanOrEqual(0);
	});
	it("bounds recorder output and returns detached snapshots", () => {
		const recorder = new Recorder<{ simTimeMs: number; value: number }>(2, 10);
		recorder.push({ simTimeMs: 0, value: 1 });
		recorder.push({ simTimeMs: 1, value: 2 });
		recorder.push({ simTimeMs: 12, value: 3 });
		expect(recorder.read()).toEqual([{ simTimeMs: 12, value: 3 }]);
		expect(recorder.drain()).toHaveLength(1);
		expect(recorder.read()).toEqual([]);
		const experiment = createExperiment(
			{ neuronCount: 100, initialOutdegree: 1, synapseBudget: 100 },
			4,
		);
		experiment.advanceTo(100);
		const snapshot = createSnapshot(experiment);
		const telemetry = createTelemetry(experiment, "run", 1, "paused");
		expect(snapshot.simTimeMs).toBe(100);
		expect(telemetry.runId).toBe("run");
	});
	it("prunes expired edges and creates bounded replacement edges", () => {
		const config = resolveBrainConfig({
			neuronCount: 100,
			initialOutdegree: 0,
			synapseBudget: 100,
			maxOutdegree: 1,
		});
		const network = new Network(config);
		for (let id = 0; id < 100; id++)
			network.addNeuron(
				createNeuron(id, "excitatory", "internal", id / 100, 0, config),
			);
		const old = network.addSynapse({
			source: 0,
			target: 1,
			type: "excitatory",
			weight: 0.005,
			delayMs: 1,
			createdAt: 0,
			lastUsedAt: 0,
			eligibility: 0,
			traceUpdatedAt: 0,
			preTrace: 0,
			postTrace: 0,
			lastPlasticityDelta: 0,
		});
		const delta = updateStructure(network, 120_000, new Mulberry32(5));
		expect(delta.removed).toContain(old.id);
		expect(delta.added.length).toBeGreaterThan(0);
		expect(network.neurons.size).toBe(100);
		network.assertIntegrity();
	});
});
