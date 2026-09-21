import type { Network } from "../core/network";
export function decay(value: number, elapsed: number, tau: number) {
	return value * Math.exp(-Math.max(0, elapsed) / tau);
}
export function applyReward(
	network: Network,
	nowMs: number,
	reward: number,
): number {
	if (
		network.config.learningMode === "frozen" ||
		network.config.learningMode === "no_reward" ||
		reward === 0
	)
		return 0;
	let count = 0;
	for (const synapse of network.synapses.values()) {
		const eligibility = decay(
			synapse.eligibility,
			nowMs - synapse.traceUpdatedAt,
			2000,
		);
		if (Math.abs(eligibility) < 1e-6) continue;
		if (synapse.type !== "excitatory") continue;
		const delta = network.config.stdpLearningRate * reward * eligibility;
		synapse.weight = Math.max(0, Math.min(1, synapse.weight + delta));
		synapse.lastPlasticityDelta = delta;
		synapse.eligibility = eligibility;
		synapse.traceUpdatedAt = nowMs;
		count++;
	}
	return count;
}

/** Updates only the edge involved in a local spike event.  Trace state is lazily decayed. */
export function recordPreArrival(
	network: Network,
	synapseId: number,
	nowMs: number,
): void {
	const synapse = network.synapses.get(synapseId);
	if (!synapse) return;
	const elapsed = nowMs - synapse.traceUpdatedAt;
	synapse.preTrace = decay(synapse.preTrace, elapsed, 20) + 1;
	synapse.postTrace = decay(synapse.postTrace, elapsed, 20);
	synapse.eligibility = Math.max(
		-1,
		Math.min(
			1,
			decay(synapse.eligibility, elapsed, 2000) - 0.012 * synapse.postTrace,
		),
	);
	synapse.traceUpdatedAt = nowMs;
}

export function recordPostSpike(
	network: Network,
	neuronId: number,
	nowMs: number,
): void {
	for (const id of network.incoming.get(neuronId) ?? []) {
		const synapse = network.synapses.get(id);
		if (!synapse) continue;
		const elapsed = nowMs - synapse.traceUpdatedAt;
		synapse.preTrace = decay(synapse.preTrace, elapsed, 20);
		synapse.postTrace = decay(synapse.postTrace, elapsed, 20) + 1;
		synapse.eligibility = Math.max(
			-1,
			Math.min(
				1,
				decay(synapse.eligibility, elapsed, 2000) + 0.01 * synapse.preTrace,
			),
		);
		synapse.traceUpdatedAt = nowMs;
	}
}
