import type { Network } from "../core/network";
export function nearestNeuronIds(
	network: Network,
	sourceId: number,
	limit: number,
): number[] {
	const source = network.neurons.get(sourceId);
	if (!source) return [];
	return [...network.neurons.values()]
		.filter((n) => n.id !== sourceId)
		.sort(
			(a, b) =>
				Math.hypot(
					source.position.x - a.position.x,
					source.position.y - a.position.y,
				) -
					Math.hypot(
						source.position.x - b.position.x,
						source.position.y - b.position.y,
					) || a.id - b.id,
		)
		.slice(0, limit)
		.map((n) => n.id);
}
