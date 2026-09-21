import type { BodyState } from "./body-state";
import { clamp01 } from "./body-state";
import type { World } from "../environment/world";
export function metabolize(
	body: BodyState,
	world: World,
	elapsedMs: number,
): void {
	if (!body.alive) return;
	const seconds = elapsedMs / 1000;
	body.energy = clamp01(body.energy - 0.001 * seconds);
	body.hunger = clamp01(body.hunger + 0.002 * seconds);
	body.fatigue = clamp01(body.fatigue + 0.001 * seconds);
	body.matingDrive = clamp01(body.matingDrive + 0.0005 * seconds);
	if (
		world.entities.danger.some(
			(c) => c.x === world.agent.x && c.y === world.agent.y,
		)
	)
		body.energy = clamp01(body.energy - 0.05 * seconds);
	if (body.energy <= 0) body.alive = false;
}
