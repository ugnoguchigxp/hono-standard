import { resolveBrainConfig, type ConfigOverrides } from "../core/config";
import { BrainRuntime } from "../runtime/brain-runtime";
import { createRandomStreams } from "../runtime/random";
import { generateNetwork } from "../topology/generator";
import { createBody, homeostaticError } from "../organism/body-state";
import { createWorld, type Action } from "../environment/world";
import { applyAction } from "../environment/interaction";
import { metabolize } from "../organism/metabolism";
import { decodeMotor } from "../organism/actuators";
import { readSensors } from "../organism/sensors";
import { initialModulatorState } from "../modulation/modulator-state";
import { updateModulators } from "../modulation/modulator-runtime";
import { applyReward } from "../plasticity/stdp";
import { applyHomeostasis } from "../plasticity/homeostasis";
import { updateStructure } from "../plasticity/structural-plasticity";
import { applyScenario, type Scenario } from "./scenario";

export type Experiment = ReturnType<typeof createExperiment>;
export const MAX_SIM_TIME_MS = 1_800_000;
export function createExperiment(
	configOverrides: ConfigOverrides = {},
	seed = 1,
	scenario: Scenario = "food",
) {
	const config = resolveBrainConfig(configOverrides);
	const streams = createRandomStreams(seed);
	const runtime = new BrainRuntime(generateNetwork(config, streams.topology));
	const body = createBody();
	const world = createWorld(streams.world);
	applyScenario(scenario, world, body);
	let modulator = initialModulatorState();
	let previousError = homeostaticError(body);
	let nextActionAt = 100;
	let nextSensorAt = 20;
	let nextHomeostasisAt = 10_000;
	let nextStructuralAt = 60_000;
	const actions: Array<{ atMs: number; action: Action; succeeded: boolean }> =
		[];
	const tick = (targetMs: number, maxEvents = 2000) => {
		targetMs = Math.min(targetMs, MAX_SIM_TIME_MS);
		while (runtime.simTimeMs < targetMs && body.alive) {
			const until = Math.min(
				targetMs,
				nextSensorAt,
				nextActionAt,
				nextHomeostasisAt,
				nextStructuralAt,
			);
			const result = runtime.advanceTo(until, maxEvents);
			if (result.needsContinuation) return result;
			if (runtime.simTimeMs === nextSensorAt) {
				for (const [channel, value] of readSensors(world, body).entries()) {
					const probability = Math.max(0, Math.min(1, value * 0.4));
					for (let offset = 0; offset < config.sensoryPerChannel; offset++)
						if (streams.sensory.next() < probability)
							runtime.inject(
								channel * config.sensoryPerChannel + offset,
								1.1,
								nextSensorAt,
							);
				}
				const internal = runtime.network.roleIds("internal");
				for (let i = 0; i < 4; i++)
					if (internal.length) {
						const neuronId = internal[streams.sensory.int(internal.length)];
						if (neuronId !== undefined)
							runtime.inject(neuronId, 0.55, nextSensorAt);
					}
				nextSensorAt += 20;
			}
			if (runtime.simTimeMs === nextActionAt) {
				metabolize(body, world, 100);
				const motors = runtime.network.roleIds("motor").reduce((counts, id) => {
					const n = runtime.network.neurons.get(id);
					if (!n) return counts;
					const index = Math.floor(
						(id -
							(config.neuronCount -
								config.motorActions * config.motorPerAction)) /
							config.motorPerAction,
					);
					if (n.lastSpikeAt > nextActionAt - 100) counts[index]++;
					return counts;
				}, Array<number>(config.motorActions).fill(0));
				const action = decodeMotor(motors, streams.action);
				if (action) {
					const result = applyAction(world, body, action, nextActionAt);
					actions.push({
						atMs: nextActionAt,
						action,
						succeeded: result.succeeded,
					});
				}
				const error = homeostaticError(body);
				modulator = updateModulators(
					modulator,
					previousError,
					error,
					readSensors(world, body)[4] ?? 0,
					0,
				);
				applyReward(runtime.network, nextActionAt, modulator.reward);
				previousError = error;
				nextActionAt += 100;
			}
			if (runtime.simTimeMs === nextHomeostasisAt) {
				applyHomeostasis(
					runtime.network,
					nextHomeostasisAt,
					3 + modulator.arousal * 5,
				);
				nextHomeostasisAt += 10_000;
			}
			if (runtime.simTimeMs === nextStructuralAt) {
				updateStructure(runtime.network, nextStructuralAt, streams.structural);
				nextStructuralAt += 60_000;
			}
		}
		if (runtime.simTimeMs >= MAX_SIM_TIME_MS && body.alive) {
			runtime.status = "completed";
			runtime.terminalReason = "time_limit";
		}
		if (!body.alive) {
			runtime.status = "dead";
			runtime.terminalReason = "energy_depleted";
		}
		return {
			simTimeMs: runtime.simTimeMs,
			eventsProcessed: 0,
			needsContinuation: false,
		};
	};
	return {
		config,
		seed,
		scenario,
		runtime,
		body,
		world,
		get modulator() {
			return modulator;
		},
		actions,
		advanceTo: tick,
		snapshot: () => ({
			...runtime.readSnapshot(),
			body: { ...body },
			world: structuredClone(world),
			modulator: { ...modulator },
			actions: [...actions],
		}),
	};
}
