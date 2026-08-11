import type { Action3dContentRegistry, Action3dWorld } from "./content";
import {
	ACTION3D_STATE_SCHEMA_VERSION,
	type Action3dEnemyState,
	type Action3dEvent,
	type Action3dInput,
	type Action3dState,
	cloneAction3dState,
} from "./model";
import {
	updateAction3dEnemy,
	updateAction3dProjectiles,
} from "./simulation/enemy-behavior";
import { updateAction3dPlayer } from "./simulation/player-controller";
import { updateAction3dWorldProgression } from "./simulation/world-progression";

const createEnemyState = (
	registry: Action3dContentRegistry,
	enemy: Action3dWorld["enemies"][number],
): Action3dEnemyState => {
	const archetype = registry.getEnemyArchetype(enemy.archetypeId);
	return {
		id: enemy.id,
		archetypeId: archetype.id,
		position: { ...enemy.position },
		yaw: 0,
		hp: archetype.maxHp,
		maxHp: archetype.maxHp,
		state: "idle",
		stateElapsedMs: 0,
		attackCooldownMs: 0,
	};
};

export function createInitialAction3dState(
	registry: Action3dContentRegistry,
): Action3dState {
	return createAction3dWorldState(
		{
			schemaVersion: ACTION3D_STATE_SCHEMA_VERSION,
			contentVersion: registry.contentVersion,
			revision: 0,
			elapsedMs: 0,
			phase: "playing",
			location: { worldId: "", spawnId: "", checkpointId: "" },
			player: {
				position: { x: 0, y: 0, z: 0 },
				velocity: { x: 0, y: 0, z: 0 },
				yaw: 0,
				hp: registry.playerTuning.maxHp,
				maxHp: registry.playerTuning.maxHp,
				stamina: registry.playerTuning.maxStamina,
				maxStamina: registry.playerTuning.maxStamina,
				grounded: true,
				locomotion: "idle",
				activeAttackId: null,
				attackElapsedMs: null,
				attackComboIndex: 0,
				attackQueued: false,
				attackHitEnemyIds: [],
				dodgeElapsedMs: null,
				dodgeCooldownMs: 0,
				invulnerableMs: 0,
				lockOnEnemyId: null,
			},
			enemies: [],
			projectiles: [],
			completedWorldIds: [],
			pendingTransition: null,
		},
		registry,
		registry.entryPoint.worldId,
		registry.entryPoint.spawnId,
	);
}

export function createAction3dWorldState(
	current: Action3dState,
	registry: Action3dContentRegistry,
	worldId: string,
	spawnId: string,
): Action3dState {
	const state = cloneAction3dState(current);
	const world = registry.getWorld(worldId);
	const spawn = world.spawnPoints.find((item) => item.id === spawnId);
	if (!spawn) throw new Error(`Unknown Action3D spawn '${spawnId}'.`);
	state.phase = "playing";
	state.location = {
		worldId: world.id,
		spawnId: spawn.id,
		checkpointId: spawn.checkpointId,
	};
	state.player.position = { ...spawn.position };
	state.player.velocity = { x: 0, y: 0, z: 0 };
	state.player.yaw = spawn.yaw;
	state.player.hp = state.player.maxHp;
	state.player.stamina = state.player.maxStamina;
	state.player.grounded = true;
	state.player.locomotion = "idle";
	state.player.activeAttackId = null;
	state.player.attackElapsedMs = null;
	state.player.attackComboIndex = 0;
	state.player.attackQueued = false;
	state.player.attackHitEnemyIds = [];
	state.player.dodgeElapsedMs = null;
	state.player.dodgeCooldownMs = 0;
	state.player.invulnerableMs = 0;
	state.player.lockOnEnemyId = null;
	state.enemies = world.enemies.map((enemy) =>
		createEnemyState(registry, enemy),
	);
	state.projectiles = [];
	state.pendingTransition = null;
	return state;
}

export function stepAction3dState(
	current: Action3dState,
	registry: Action3dContentRegistry,
	input: Action3dInput,
	stepMs: number,
): { state: Action3dState; events: Action3dEvent[] } {
	const state = cloneAction3dState(current);
	const events = stepOwnedAction3dState(state, registry, input, stepMs);
	return { state, events };
}

/**
 * Advances state owned exclusively by Action3dSession. The public simulation
 * entrypoint remains immutable while the render loop avoids a whole-world clone
 * on every fixed step.
 */
export function stepOwnedAction3dState(
	state: Action3dState,
	registry: Action3dContentRegistry,
	input: Action3dInput,
	stepMs: number,
): Action3dEvent[] {
	if (!Number.isFinite(stepMs) || stepMs <= 0)
		throw new Error("Action3D step must be a positive finite duration.");
	if (state.phase !== "playing") return [];
	const world = registry.getWorld(state.location.worldId);
	const events: Action3dEvent[] = [];
	state.revision += 1;
	state.elapsedMs += stepMs;
	updateAction3dPlayer(state, registry, world, input, stepMs, events);
	updateAction3dProjectiles(state, registry, world, stepMs, events);
	for (const enemy of state.enemies)
		updateAction3dEnemy(state, enemy, registry, world, stepMs, events);
	if (state.player.hp === 0) {
		state.phase = "defeat";
		state.player.locomotion = "defeated";
		events.push({ type: "defeat" });
	} else {
		updateAction3dWorldProgression(state, world, events);
	}
	return events;
}

export function createAction3dCheckpointState(
	state: Action3dState,
	registry: Action3dContentRegistry,
): Action3dState {
	const stable = cloneAction3dState(state);
	const world = registry.getWorld(state.location.worldId);
	const checkpoint = world.checkpoints.find(
		(item) => item.id === state.location.checkpointId,
	);
	if (!checkpoint)
		throw new Error(
			`Unknown Action3D checkpoint '${state.location.checkpointId}'.`,
		);
	stable.player.position = { ...checkpoint.position };
	stable.player.velocity = { x: 0, y: 0, z: 0 };
	stable.player.yaw = checkpoint.yaw;
	stable.player.hp = stable.player.maxHp;
	stable.player.stamina = stable.player.maxStamina;
	stable.player.grounded = true;
	stable.player.locomotion =
		stable.phase === "defeat" ? "idle" : stable.player.locomotion;
	stable.player.activeAttackId = null;
	stable.player.attackElapsedMs = null;
	stable.player.attackComboIndex = 0;
	stable.player.attackQueued = false;
	stable.player.attackHitEnemyIds = [];
	stable.player.dodgeElapsedMs = null;
	stable.player.dodgeCooldownMs = 0;
	stable.player.invulnerableMs = 0;
	stable.player.lockOnEnemyId = null;
	stable.projectiles = [];
	stable.pendingTransition = null;
	if (stable.phase === "defeat" || stable.phase === "transitioning")
		stable.phase = "playing";
	return stable;
}
