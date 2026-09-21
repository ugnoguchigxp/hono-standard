import type { World } from "../environment/world";
import type { BodyState } from "../organism/body-state";
export const scenarios = [
	"food",
	"shelter",
	"mating",
	"competing",
	"risk",
] as const;
export type Scenario = (typeof scenarios)[number];
export function applyScenario(
	scenario: Scenario,
	world: World,
	body: BodyState,
): void {
	world.agent.x = 16;
	world.agent.y = 16;
	world.agent.direction = 0;
	world.entities.food = [{ x: 16, y: 15 }];
	world.entities.shelter = [{ x: 18, y: 16 }];
	world.entities.mate = [{ x: 14, y: 16 }];
	world.entities.danger = [];
	if (scenario === "shelter") {
		body.fatigue = 0.7;
		world.entities.food = [{ x: 17, y: 16 }];
	}
	if (scenario === "mating") body.matingDrive = 0.8;
	if (scenario === "competing" || scenario === "risk") {
		body.hunger = 0.7;
		body.fatigue = 0.7;
		body.matingDrive = 0.7;
	}
	if (scenario === "risk") world.entities.danger = [{ x: 16, y: 15 }];
}
