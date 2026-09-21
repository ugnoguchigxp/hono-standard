import { describe, expect, it } from "vitest";
import { resolveBrainConfig } from "./core/config";
import { Network, createNeuron } from "./core/network";
import { createWorld } from "./environment/world";
import { applyScenario, scenarios } from "./experiment/scenario";
import { updateModulators } from "./modulation/modulator-runtime";
import { initialModulatorState } from "./modulation/modulator-state";
import { decodeMotor } from "./organism/actuators";
import { createBody } from "./organism/body-state";
import { metabolize } from "./organism/metabolism";
import { applyHomeostasis } from "./plasticity/homeostasis";
import { Mulberry32 } from "./runtime/random";
import { createExperiment } from "./experiment/experiment";

describe("brain rules", () => {
	it("applies each fixed scenario deterministically", () => {
		for (const scenario of scenarios) {
			const world = createWorld(new Mulberry32(1));
			const body = createBody();
			applyScenario(scenario, world, body);
			expect(world.agent).toMatchObject({ x: 16, y: 16 });
		}
		const riskWorld = createWorld(new Mulberry32(1));
		const riskBody = createBody();
		applyScenario("risk", riskWorld, riskBody);
		expect(riskWorld.entities.danger).toHaveLength(1);
		expect(riskBody.hunger).toBe(0.7);
	});
	it("decodes only positive motor spikes and makes deterministic ties", () => {
		const random = new Mulberry32(2);
		expect(decodeMotor([0, 0, 0, 0, 0, 0], random)).toBeUndefined();
		expect(decodeMotor([0, 2, 0, 0, 0, 0], random)).toBe("turn_left");
		expect(decodeMotor([1, 1, 0, 0, 0, 0], new Mulberry32(2))).toBe(
			decodeMotor([1, 1, 0, 0, 0, 0], new Mulberry32(2)),
		);
	});
	it("metabolizes, applies danger, and adjusts homeostatic thresholds", () => {
		const world = createWorld(new Mulberry32(1));
		const body = createBody({ energy: 0.01 });
		world.entities.danger = [{ x: world.agent.x, y: world.agent.y }];
		metabolize(body, world, 1000);
		expect(body.energy).toBe(0);
		expect(body.alive).toBe(false);
		const config = resolveBrainConfig({
			neuronCount: 100,
			initialOutdegree: 0,
		});
		const network = new Network(config);
		network.addNeuron(createNeuron(0, "excitatory", "internal", 0, 0, config));
		network.updateNeuron(0, { activity: 10, activityUpdatedAt: 0 });
		applyHomeostasis(network, 0, 5);
		expect(network.neurons.get(0)?.threshold).toBeGreaterThan(config.threshold);
	});
	it("bounds modulator values", () => {
		const state = updateModulators(initialModulatorState(), 0, 1, 2, 2);
		expect(state.reward).toBe(-1);
		expect(state.threat).toBe(1);
		expect(state.novelty).toBe(1);
	});
	it("reports death as a terminal runtime state", () => {
		const experiment = createExperiment(
			{ neuronCount: 100, initialOutdegree: 0 },
			1,
		);
		experiment.body.energy = 0;
		experiment.advanceTo(100);
		expect(experiment.runtime.status).toBe("dead");
		expect(experiment.runtime.terminalReason).toBe("energy_depleted");
	});
});
