import type { Network } from "../core/network";
import { nearestNeuronIds } from "../topology/spatial-index";
import type { Mulberry32 } from "../runtime/random";

export type StructuralDelta = { removed: number[]; added: number[] };

/** Bounded, deterministic maintenance. Node identities and positions are never touched. */
export function updateStructure(
	network: Network,
	nowMs: number,
	random: Mulberry32,
): StructuralDelta {
	if (
		network.config.learningMode === "frozen" ||
		network.config.learningMode === "no_structural"
	)
		return { removed: [], added: [] };
	const removed: number[] = [];
	for (const synapse of [...network.synapses.values()].sort(
		(a, b) => a.id - b.id,
	)) {
		if (removed.length >= 64) break;
		if (
			nowMs - synapse.createdAt >= 120_000 &&
			(synapse.weight < 0.01 || nowMs - synapse.lastUsedAt >= 120_000)
		) {
			network.removeSynapse(synapse.id);
			removed.push(synapse.id);
		}
	}
	const added: number[] = [];
	for (const source of [...network.neurons.keys()].sort((a, b) => a - b)) {
		if (
			added.length >= 64 ||
			network.synapses.size >= network.config.synapseBudget
		)
			break;
		if (
			(network.outgoing.get(source)?.size ?? 0) >= network.config.maxOutdegree
		)
			continue;
		const targets = nearestNeuronIds(network, source, 8).filter(
			(target) =>
				![...(network.outgoing.get(source) ?? [])].some(
					(id) => network.synapses.get(id)?.target === target,
				),
		);
		if (!targets.length) continue;
		const target = targets[random.int(targets.length)];
		const sourceNeuron = network.neurons.get(source);
		if (target === undefined || !sourceNeuron) continue;
		const synapse = network.addSynapse({
			source,
			target,
			type: sourceNeuron.type,
			weight: 0.05,
			delayMs: network.config.minDelayMs,
			createdAt: nowMs,
			lastUsedAt: nowMs,
			eligibility: 0,
			traceUpdatedAt: nowMs,
			preTrace: 0,
			postTrace: 0,
			lastPlasticityDelta: 0,
		});
		added.push(synapse.id);
	}
	return { removed, added };
}
