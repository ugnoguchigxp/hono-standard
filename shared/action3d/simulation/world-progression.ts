import type { Action3dWorld } from "../content";
import type { Action3dEvent, Action3dState } from "../model";
import { pointInsideBounds } from "./world-query";

export const updateAction3dWorldProgression = (
	state: Action3dState,
	world: Action3dWorld,
	events: Action3dEvent[],
) => {
	const worldClear = state.enemies.every((enemy) => enemy.state === "defeated");
	if (worldClear) {
		state.location.checkpointId = world.victoryCheckpointId;
		if (!state.completedWorldIds.includes(world.id))
			state.completedWorldIds.push(world.id);
		if (world.finalWorld) {
			state.phase = "victory";
			events.push({
				type: "victory",
				checkpointId: world.victoryCheckpointId,
			});
		}
	}
	if (state.phase !== "playing") return;
	const exit = world.exits.find(
		(candidate) =>
			(!candidate.requiresWorldClear || worldClear) &&
			pointInsideBounds(state.player.position, candidate.bounds),
	);
	if (!exit) return;
	state.phase = "transitioning";
	state.pendingTransition = {
		exitId: exit.id,
		worldId: exit.destinationWorldId,
		spawnId: exit.destinationSpawnId,
	};
	events.push({
		type: "world-transition-requested",
		exitId: exit.id,
		worldId: exit.destinationWorldId,
		spawnId: exit.destinationSpawnId,
	});
};
