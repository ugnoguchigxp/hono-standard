import type { BrainConfig } from "./config";
import type { Neuron, NeuronRole, NeuronType, Synapse } from "./types";

export class Network {
	readonly neurons = new Map<number, Neuron>();
	readonly synapses = new Map<number, Synapse>();
	readonly incoming = new Map<number, Set<number>>();
	readonly outgoing = new Map<number, Set<number>>();
	private nextSynapseId = 1;
	topologyVersion = 0;
	constructor(readonly config: BrainConfig) {}
	addNeuron(neuron: Neuron): void {
		if (this.neurons.has(neuron.id)) throw new Error("Duplicate neuron");
		this.neurons.set(neuron.id, Object.freeze({ ...neuron }));
		this.incoming.set(neuron.id, new Set());
		this.outgoing.set(neuron.id, new Set());
	}
	addSynapse(input: Omit<Synapse, "id">): Synapse {
		if (!this.neurons.has(input.source) || !this.neurons.has(input.target))
			throw new Error("Unknown neuron");
		if (input.source === input.target)
			throw new Error("Self connections are forbidden");
		if (this.synapses.size >= this.config.synapseBudget)
			throw new RangeError("synapse budget exceeded");
		const outgoing = this.outgoing.get(input.source);
		const incoming = this.incoming.get(input.target);
		if (!outgoing || !incoming) throw new Error("Network index mismatch");
		if (outgoing.size >= this.config.maxOutdegree)
			throw new RangeError("max outdegree exceeded");
		for (const id of outgoing)
			if (this.synapses.get(id)?.target === input.target)
				throw new Error("Duplicate synapse");
		const synapse: Synapse = { ...input, id: this.nextSynapseId++ };
		this.synapses.set(synapse.id, synapse);
		outgoing.add(synapse.id);
		incoming.add(synapse.id);
		this.topologyVersion++;
		return synapse;
	}
	removeSynapse(id: number): boolean {
		const synapse = this.synapses.get(id);
		if (!synapse) return false;
		this.synapses.delete(id);
		this.outgoing.get(synapse.source)?.delete(id);
		this.incoming.get(synapse.target)?.delete(id);
		this.topologyVersion++;
		return true;
	}
	updateNeuron(id: number, change: Partial<Neuron>): Neuron {
		const prior = this.neurons.get(id);
		if (!prior) throw new Error("Unknown neuron");
		const next = {
			...prior,
			...change,
			id: prior.id,
			type: prior.type,
			role: prior.role,
			position: prior.position,
		};
		this.neurons.set(id, next);
		return next;
	}
	cloneSnapshot() {
		return {
			topologyVersion: this.topologyVersion,
			neurons: [...this.neurons.values()].map((n) => ({
				...n,
				position: { ...n.position },
			})),
			synapses: [...this.synapses.values()].map((s) => ({ ...s })),
		};
	}
	roleIds(role: NeuronRole): number[] {
		return [...this.neurons.values()]
			.filter((n) => n.role === role)
			.map((n) => n.id);
	}
	assertIntegrity(): void {
		for (const [id, synapse] of this.synapses) {
			if (
				!this.outgoing.get(synapse.source)?.has(id) ||
				!this.incoming.get(synapse.target)?.has(id)
			)
				throw new Error("Network index mismatch");
		}
	}
}
export function createNeuron(
	id: number,
	type: NeuronType,
	role: NeuronRole,
	x: number,
	y: number,
	config: BrainConfig,
): Neuron {
	return {
		id,
		type,
		role,
		position: Object.freeze({ x, y }),
		potential: config.restingPotential,
		threshold: config.threshold,
		refractoryUntil: 0,
		lastUpdatedAt: 0,
		lastSpikeAt: -Infinity,
		activity: 0,
		activityUpdatedAt: 0,
		sensitivity: 0.5 + ((id * 2654435761) >>> 0) / 4294967296,
	};
}
