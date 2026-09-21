import type { Network } from "../core/network";
export function applyHomeostasis(
	network: Network,
	nowMs: number,
	targetHz = 5,
): void {
	if (network.config.learningMode === "frozen") return;
	for (const n of network.neurons.values()) {
		const rate = n.activity * Math.exp(-(nowMs - n.activityUpdatedAt) / 1000);
		const next = Math.max(
			0.3,
			Math.min(3, n.threshold + (rate > targetHz ? 0.02 : -0.02)),
		);
		network.updateNeuron(n.id, {
			threshold: next,
			activity: rate,
			activityUpdatedAt: nowMs,
		});
	}
}
