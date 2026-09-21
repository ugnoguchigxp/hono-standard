import { useEffect, useRef } from "react";
type Neuron = {
	id: number;
	type: "excitatory" | "inhibitory";
	role: string;
	position: { x: number; y: number };
	activity: number;
};
type Synapse = { source: number; target: number; weight: number; type: string };
export function NeuralCanvas({
	neurons = [],
	synapses = [],
}: {
	neurons?: Neuron[];
	synapses?: Synapse[];
}) {
	const canvas = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		const node = canvas.current;
		if (!node) return;
		const context = node.getContext("2d");
		if (!context) return;
		const size = 480,
			dpr = window.devicePixelRatio || 1;
		node.width = size * dpr;
		node.height = size * dpr;
		context.scale(dpr, dpr);
		context.fillStyle = "#0c1118";
		context.fillRect(0, 0, size, size);
		const byId = new Map(neurons.map((neuron) => [neuron.id, neuron]));
		context.globalAlpha = 0.2;
		for (const edge of synapses
			.filter((edge) => edge.weight >= 0.2)
			.slice(0, 2000)) {
			const a = byId.get(edge.source),
				b = byId.get(edge.target);
			if (!a || !b) continue;
			context.strokeStyle = edge.type === "inhibitory" ? "#e16b75" : "#64b5f6";
			context.lineWidth = Math.max(0.5, edge.weight * 2);
			context.beginPath();
			context.moveTo(a.position.x * size, a.position.y * size);
			context.lineTo(b.position.x * size, b.position.y * size);
			context.stroke();
		}
		context.globalAlpha = 1;
		for (const neuron of neurons) {
			context.fillStyle = neuron.type === "inhibitory" ? "#e16b75" : "#64b5f6";
			context.globalAlpha = Math.min(1, 0.35 + neuron.activity * 0.2);
			context.beginPath();
			context.arc(
				neuron.position.x * size,
				neuron.position.y * size,
				neuron.role === "motor" ? 4 : 2,
				0,
				Math.PI * 2,
			);
			context.fill();
		}
		context.globalAlpha = 1;
	}, [neurons, synapses]);
	return (
		<figure>
			<canvas
				ref={canvas}
				width="480"
				height="480"
				role="img"
				aria-label="Neural network map"
				style={{ width: "min(100%, 480px)", aspectRatio: "1" }}
			/>
			<figcaption>
				Blue: excitatory · Red: inhibitory · brighter nodes are recently active
			</figcaption>
		</figure>
	);
}
