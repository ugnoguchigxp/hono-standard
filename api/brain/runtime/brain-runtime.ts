import type { AdvanceResult } from "../core/types";
import { terminalStatuses } from "../core/types";
import { EventQueue } from "./event-queue";
import type { Network } from "../core/network";
import { recordPostSpike, recordPreArrival } from "../plasticity/stdp";

export class BrainRuntime {
	readonly queue: EventQueue;
	simTimeMs = 0;
	status:
		| "paused"
		| "running"
		| "completed"
		| "dead"
		| "failed"
		| "interrupted" = "paused";
	spikes = 0;
	propagated = 0;
	invalidDeliveries = 0;
	visitedNeurons = 0;
	terminalReason?: string;
	constructor(readonly network: Network) {
		this.queue = new EventQueue(network.config.queueLimit);
	}
	inject(neuronId: number, strength: number, atMs = this.simTimeMs): void {
		if (
			!this.network.neurons.has(neuronId) ||
			!Number.isFinite(strength) ||
			atMs < this.simTimeMs
		)
			throw new RangeError("Invalid input");
		this.queue.push({ atMs, phase: 1, kind: "input", neuronId, strength });
	}
	advanceTo(targetSimMs: number, maxEvents = 2000): AdvanceResult {
		if (
			!Number.isInteger(targetSimMs) ||
			targetSimMs < this.simTimeMs ||
			!Number.isInteger(maxEvents) ||
			maxEvents < 1
		)
			throw new RangeError("Invalid advance target");
		if (terminalStatuses.has(this.status)) return this.result(0, false);
		this.status = "running";
		let processed = 0;
		try {
			while (processed < maxEvents) {
				const event = this.queue.peek();
				if (!event || event.atMs > targetSimMs) {
					this.simTimeMs = targetSimMs;
					this.status = "paused";
					return this.result(processed, false);
				}
				this.queue.pop();
				this.simTimeMs = event.atMs;
				processed++;
				this.process(event);
				if (terminalStatuses.has(this.status))
					return this.result(processed, false);
			}
			this.status = "paused";
			return this.result(processed, this.queue.peek()?.atMs <= targetSimMs);
		} catch (error) {
			this.status = "failed";
			this.terminalReason =
				error instanceof Error && error.message === "queue_limit"
					? "queue_limit"
					: "runtime_error";
			return this.result(processed, false);
		}
	}
	private result(
		eventsProcessed: number,
		needsContinuation: boolean,
	): AdvanceResult {
		return {
			simTimeMs: this.simTimeMs,
			eventsProcessed,
			needsContinuation,
			terminalReason: this.terminalReason,
		};
	}
	private process(event: {
		kind: string;
		neuronId?: number;
		synapseId?: number;
		strength?: number;
	}): void {
		if (event.kind === "input") {
			if (event.neuronId === undefined || event.strength === undefined) {
				this.invalidDeliveries++;
				return;
			}
			this.receive(event.neuronId, event.strength);
			return;
		}
		if (event.synapseId === undefined || event.strength === undefined) {
			this.invalidDeliveries++;
			return;
		}
		const synapse = this.network.synapses.get(event.synapseId);
		if (!synapse) {
			this.invalidDeliveries++;
			return;
		}
		synapse.lastUsedAt = this.simTimeMs;
		recordPreArrival(this.network, synapse.id, this.simTimeMs);
		this.propagated++;
		this.receive(synapse.target, event.strength);
	}
	private receive(neuronId: number, strength: number): void {
		const neuron = this.network.neurons.get(neuronId);
		if (!neuron) return;
		this.visitedNeurons++;
		if (this.simTimeMs < neuron.refractoryUntil) return;
		const elapsed = this.simTimeMs - neuron.lastUpdatedAt;
		const potential = Math.max(
			this.network.config.minPotential,
			this.network.config.restingPotential +
				(neuron.potential - this.network.config.restingPotential) *
					Math.exp(-elapsed / this.network.config.tauMs) +
				strength,
		);
		this.network.updateNeuron(neuronId, {
			potential,
			lastUpdatedAt: this.simTimeMs,
			activity:
				neuron.activity *
				Math.exp(-(this.simTimeMs - neuron.activityUpdatedAt) / 1000),
			activityUpdatedAt: this.simTimeMs,
		});
		if (potential >= neuron.threshold) this.fire(neuronId);
	}
	private fire(neuronId: number): void {
		const neuron = this.network.neurons.get(neuronId);
		if (!neuron) return;
		this.network.updateNeuron(neuronId, {
			potential: this.network.config.restingPotential,
			refractoryUntil: this.simTimeMs + this.network.config.refractoryMs,
			lastSpikeAt: this.simTimeMs,
			activity: neuron.activity + 1,
			activityUpdatedAt: this.simTimeMs,
		});
		this.spikes++;
		recordPostSpike(this.network, neuronId, this.simTimeMs);
		for (const id of this.network.outgoing.get(neuronId) ?? []) {
			const synapse = this.network.synapses.get(id);
			if (!synapse) continue;
			const sign = synapse.type === "inhibitory" ? -1 : 1;
			this.queue.push({
				atMs: this.simTimeMs + synapse.delayMs,
				phase: 2,
				kind: "arrival",
				synapseId: id,
				strength: sign * synapse.weight,
			});
		}
	}
	readSnapshot() {
		return Object.freeze({
			simTimeMs: this.simTimeMs,
			status: this.status,
			terminalReason: this.terminalReason,
			counters: {
				spikes: this.spikes,
				propagated: this.propagated,
				invalidDeliveries: this.invalidDeliveries,
				visitedNeurons: this.visitedNeurons,
			},
			...this.network.cloneSnapshot(),
		});
	}
}
