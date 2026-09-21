import type { BodyState } from "./body-state";
import type { World } from "../environment/world";
export type SensorVector = readonly number[];
function signal(
	world: World,
	type: keyof World["entities"],
	dx: number,
	dy: number,
) {
	return Math.max(
		0,
		...world.entities[type].map(
			(e) =>
				1 /
				(1 +
					Math.hypot(e.x - (world.agent.x + dx), e.y - (world.agent.y + dy))),
		),
	);
}
export function readSensors(world: World, body: BodyState): SensorVector {
	const right =
		world.agent.direction === 0
			? [1, 0]
			: world.agent.direction === 1
				? [0, 1]
				: world.agent.direction === 2
					? [-1, 0]
					: [0, -1];
	const left = [-right[0], -right[1]];
	return Object.freeze([
		signal(world, "food", left[0], left[1]),
		signal(world, "food", right[0], right[1]),
		signal(world, "mate", left[0], left[1]),
		signal(world, "mate", right[0], right[1]),
		signal(world, "danger", 0, 0),
		0.5,
		signal(world, "shelter", 0, 0),
		0,
		body.energy,
		body.hunger,
		body.fatigue,
		body.matingDrive,
	]);
}
