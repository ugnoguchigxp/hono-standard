import type { BodyState } from "../organism/body-state";
import { clamp01 } from "../organism/body-state";
import type { Action, World } from "./world";
const directionDelta = [
	[0, -1],
	[1, 0],
	[0, 1],
	[-1, 0],
] as const;
export type ActionResult = {
	action: Action;
	succeeded: boolean;
	energyCost: number;
};
export function applyAction(
	world: World,
	body: BodyState,
	action: Action,
	nowMs: number,
): ActionResult {
	if (!body.alive) return { action, succeeded: false, energyCost: 0 };
	let succeeded = false;
	let energyCost = 0;
	if (action === "move_forward") {
		energyCost = 0.001;
		const [dx, dy] = directionDelta[world.agent.direction];
		const x = world.agent.x + dx,
			y = world.agent.y + dy;
		if (x >= 0 && x < world.width && y >= 0 && y < world.height) {
			world.agent.x = x;
			world.agent.y = y;
			succeeded = true;
		}
	} else if (action === "turn_left") {
		world.agent.direction = ((world.agent.direction + 3) % 4) as 0 | 1 | 2 | 3;
		energyCost = 0.0002;
		succeeded = true;
	} else if (action === "turn_right") {
		world.agent.direction = ((world.agent.direction + 1) % 4) as 0 | 1 | 2 | 3;
		energyCost = 0.0002;
		succeeded = true;
	} else if (action === "eat") {
		const i = world.entities.food.findIndex(
			(c) => c.x === world.agent.x && c.y === world.agent.y,
		);
		if (i >= 0) {
			world.entities.food.splice(i, 1);
			body.energy = clamp01(body.energy + 0.2);
			body.hunger = clamp01(body.hunger - 0.25);
			succeeded = true;
		}
	} else if (action === "rest") {
		const sheltered = world.entities.shelter.some(
			(c) => c.x === world.agent.x && c.y === world.agent.y,
		);
		body.fatigue = clamp01(body.fatigue - (sheltered ? 0.02 : 0.002));
		succeeded = true;
	} else if (
		nowMs >= world.mateCooldownUntil &&
		world.entities.mate.some(
			(c) => c.x === world.agent.x && c.y === world.agent.y,
		)
	) {
		body.matingDrive = clamp01(body.matingDrive - 0.2);
		world.mateCooldownUntil = nowMs + 1000;
		succeeded = true;
	}
	body.energy = clamp01(body.energy - energyCost);
	if (body.energy <= 0) body.alive = false;
	return { action, succeeded, energyCost };
}
