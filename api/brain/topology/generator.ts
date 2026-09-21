import type { BrainConfig } from "../core/config";
import { createNeuron, Network } from "../core/network";
import type { NeuronRole, NeuronType } from "../core/types";
import type { Mulberry32 } from "../runtime/random";

export function generateNetwork(
	config: BrainConfig,
	random: Mulberry32,
): Network {
	const network = new Network(config);
	const sensoryCount = config.sensoryChannels * config.sensoryPerChannel;
	const motorCount = config.motorActions * config.motorPerAction;
	const inhibitoryCount = Math.round(
		config.neuronCount * config.inhibitoryFraction,
	);
	for (let id = 0; id < config.neuronCount; id++) {
		const role: NeuronRole =
			id < sensoryCount
				? "sensory"
				: id >= config.neuronCount - motorCount
					? "motor"
					: "internal";
		const type: NeuronType = id < inhibitoryCount ? "inhibitory" : "excitatory";
		network.addNeuron(
			createNeuron(id, type, role, random.next(), random.next(), config),
		);
	}
	for (let source = 0; source < config.neuronCount; source++) {
		const sourceNeuron = network.neurons.get(source);
		if (!sourceNeuron) throw new Error("Network generation failed");
		const candidates = [...network.neurons.keys()]
			.filter((target) => target !== source)
			.map((target) => {
				const b = network.neurons.get(target);
				if (!b) throw new Error("Network generation failed");
				const distance = Math.hypot(
					sourceNeuron.position.x - b.position.x,
					sourceNeuron.position.y - b.position.y,
				);
				return {
					target,
					score: Math.exp(-distance / config.distanceLambda) * random.next(),
				};
			})
			.sort((a, b) => b.score - a.score || a.target - b.target);
		for (const { target } of candidates.slice(0, config.initialOutdegree)) {
			network.addSynapse({
				source,
				target,
				type: sourceNeuron.type,
				weight:
					config.minWeight +
					random.next() * Math.min(0.25, config.maxWeight - config.minWeight),
				delayMs:
					config.minDelayMs +
					random.int(config.maxDelayMs - config.minDelayMs + 1),
				createdAt: 0,
				lastUsedAt: 0,
				eligibility: 0,
				traceUpdatedAt: 0,
				preTrace: 0,
				postTrace: 0,
				lastPlasticityDelta: 0,
			});
		}
	}
	return network;
}
