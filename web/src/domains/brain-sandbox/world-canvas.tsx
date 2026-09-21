import { useEffect, useRef } from "react";
type Cell = { x: number; y: number };
type World = {
	width: number;
	height: number;
	agent: Cell & { direction: number };
	entities: Record<string, Cell[]>;
};
const colors: Record<string, string> = {
	food: "#2c8c4d",
	shelter: "#7651a8",
	mate: "#dc6e9b",
	danger: "#cc3f3f",
};
export function WorldCanvas({ world }: { world?: World }) {
	const canvas = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		const node = canvas.current;
		if (!node || !world) return;
		const context = node.getContext("2d");
		if (!context) return;
		const size = 320;
		const dpr = window.devicePixelRatio || 1;
		node.width = size * dpr;
		node.height = size * dpr;
		context.scale(dpr, dpr);
		const cell = size / world.width;
		context.fillStyle = "#101822";
		context.fillRect(0, 0, size, size);
		context.strokeStyle = "#263544";
		context.lineWidth = 1;
		for (let i = 0; i <= world.width; i++) {
			context.beginPath();
			context.moveTo(i * cell, 0);
			context.lineTo(i * cell, size);
			context.stroke();
		}
		for (const [kind, cells] of Object.entries(world.entities)) {
			context.fillStyle = colors[kind] ?? "#fff";
			for (const entity of cells)
				context.fillRect(
					entity.x * cell + 2,
					entity.y * cell + 2,
					cell - 4,
					cell - 4,
				);
		}
		context.fillStyle = "#f5c542";
		context.beginPath();
		context.arc(
			(world.agent.x + 0.5) * cell,
			(world.agent.y + 0.5) * cell,
			cell * 0.35,
			0,
			Math.PI * 2,
		);
		context.fill();
	}, [world]);
	return (
		<figure>
			<canvas
				ref={canvas}
				width="320"
				height="320"
				role="img"
				aria-label="Experiment world"
				style={{ width: "min(100%, 320px)", aspectRatio: "1" }}
			/>
			<figcaption>
				Food: green · Shelter: purple · Mate: pink · Danger: red · Organism:
				yellow
			</figcaption>
		</figure>
	);
}
