import type { Mulberry32 } from "../runtime/random";
export type Direction = 0 | 1 | 2 | 3;
export type Action =
	| "move_forward"
	| "turn_left"
	| "turn_right"
	| "eat"
	| "rest"
	| "mate";
export type EntityType = "food" | "shelter" | "mate" | "danger";
export type Cell = { x: number; y: number };
export type World = {
	width: number;
	height: number;
	agent: Cell & { direction: Direction };
	entities: Record<EntityType, Cell[]>;
	mateCooldownUntil: number;
};
export function createWorld(
	random: Mulberry32,
	width = 32,
	height = 32,
): World {
	const cell = (): Cell => ({ x: random.int(width), y: random.int(height) });
	return {
		width,
		height,
		agent: { ...cell(), direction: 0 },
		entities: {
			food: [cell()],
			shelter: [cell()],
			mate: [cell()],
			danger: [cell()],
		},
		mateCooldownUntil: 0,
	};
}
export function sameCell(a: Cell, b: Cell) {
	return a.x === b.x && a.y === b.y;
}
