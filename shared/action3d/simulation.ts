import type { Action3dContentRegistry, Action3dWorld } from "./content";
import {
	ACTION3D_STATE_SCHEMA_VERSION,
	cloneAction3dState,
	type Action3dEnemyState,
	type Action3dEvent,
	type Action3dInput,
	type Action3dState,
} from "./model";

const PLAYER_RADIUS = 0.42;
const WALK_SPEED = 4.2;
const RUN_SPEED = 7;
const DODGE_SPEED = 10;
const ATTACK_DAMAGE = 40;
const ATTACK_RANGE = 2.35;
const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));
const distanceSquared = (
	a: { x: number; z: number },
	b: { x: number; z: number },
) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const angleTo = (
	from: { x: number; z: number },
	to: { x: number; z: number },
) => Math.atan2(to.x - from.x, to.z - from.z);
const normalizeMove = (x: number, z: number) => {
	const length = Math.hypot(x, z);
	return length > 1 ? { x: x / length, z: z / length } : { x, z };
};
const isBlocked = (world: Action3dWorld, x: number, z: number) =>
	x < world.bounds.minX + PLAYER_RADIUS ||
	x > world.bounds.maxX - PLAYER_RADIUS ||
	z < world.bounds.minZ + PLAYER_RADIUS ||
	z > world.bounds.maxZ - PLAYER_RADIUS ||
	world.colliders.some(
		(collider) =>
			x + PLAYER_RADIUS > collider.bounds.minX &&
			x - PLAYER_RADIUS < collider.bounds.maxX &&
			z + PLAYER_RADIUS > collider.bounds.minZ &&
			z - PLAYER_RADIUS < collider.bounds.maxZ,
	);
const moveWithCollision = (
	state: Action3dState,
	world: Action3dWorld,
	dx: number,
	dz: number,
) => {
	const nextX = state.player.position.x + dx;
	if (!isBlocked(world, nextX, state.player.position.z))
		state.player.position.x = nextX;
	const nextZ = state.player.position.z + dz;
	if (!isBlocked(world, state.player.position.x, nextZ))
		state.player.position.z = nextZ;
};

export function createInitialAction3dState(
	registry: Action3dContentRegistry,
): Action3dState {
	const world = registry.getWorld(registry.entryPoint.worldId);
	const spawn = world.spawnPoints.find(
		(item) => item.id === registry.entryPoint.spawnId,
	);
	if (!spawn)
		throw new Error(`Unknown Action3D spawn '${registry.entryPoint.spawnId}'.`);
	return {
		schemaVersion: ACTION3D_STATE_SCHEMA_VERSION,
		contentVersion: registry.contentVersion,
		revision: 0,
		elapsedMs: 0,
		phase: "playing",
		location: {
			worldId: world.id,
			spawnId: spawn.id,
			checkpointId: spawn.checkpointId,
		},
		player: {
			position: { ...spawn.position },
			velocity: { x: 0, y: 0, z: 0 },
			yaw: spawn.yaw,
			hp: 100,
			maxHp: 100,
			stamina: 100,
			maxStamina: 100,
			grounded: true,
			locomotion: "idle",
			attackElapsedMs: null,
			attackHitEnemyIds: [],
			dodgeElapsedMs: null,
			dodgeCooldownMs: 0,
			invulnerableMs: 0,
			lockOnEnemyId: null,
		},
		enemies: world.enemies.map((enemy) => ({
			id: enemy.id,
			position: { ...enemy.position },
			yaw: 0,
			hp: enemy.maxHp,
			maxHp: enemy.maxHp,
			state: "idle",
			stateElapsedMs: 0,
			attackCooldownMs: 0,
		})),
	};
}

const updateLockOn = (state: Action3dState, input: Action3dInput) => {
	if (!input.lockOn) return;
	if (state.player.lockOnEnemyId) {
		state.player.lockOnEnemyId = null;
		return;
	}
	const target = state.enemies
		.filter(
			(enemy) =>
				enemy.state !== "defeated" &&
				distanceSquared(enemy.position, state.player.position) <= 144,
		)
		.sort(
			(a, b) =>
				distanceSquared(a.position, state.player.position) -
				distanceSquared(b.position, state.player.position),
		)[0];
	state.player.lockOnEnemyId = target?.id ?? null;
};

const updatePlayer = (
	state: Action3dState,
	world: Action3dWorld,
	input: Action3dInput,
	stepMs: number,
	events: Action3dEvent[],
) => {
	const player = state.player;
	const seconds = stepMs / 1000;
	player.dodgeCooldownMs = Math.max(0, player.dodgeCooldownMs - stepMs);
	player.invulnerableMs = Math.max(0, player.invulnerableMs - stepMs);
	updateLockOn(state, input);
	if (
		player.lockOnEnemyId &&
		!state.enemies.some(
			(enemy) =>
				enemy.id === player.lockOnEnemyId && enemy.state !== "defeated",
		)
	)
		player.lockOnEnemyId = null;

	if (
		input.dodge &&
		player.grounded &&
		player.dodgeCooldownMs === 0 &&
		player.stamina >= 20 &&
		player.attackElapsedMs === null
	) {
		player.dodgeElapsedMs = 0;
		player.dodgeCooldownMs = 800;
		player.invulnerableMs = 260;
		player.stamina -= 20;
	}
	if (
		input.attack &&
		player.attackElapsedMs === null &&
		player.dodgeElapsedMs === null
	) {
		player.attackElapsedMs = 0;
		player.attackHitEnemyIds = [];
	}

	const localMove = normalizeMove(
		clamp(input.moveX, -1, 1),
		clamp(input.moveZ, -1, 1),
	);
	const sin = Math.sin(input.cameraYaw);
	const cos = Math.cos(input.cameraYaw);
	let moveX = localMove.x * cos + localMove.z * sin;
	let moveZ = localMove.z * cos - localMove.x * sin;
	const moving = Math.hypot(moveX, moveZ) > 0.05;
	if (player.dodgeElapsedMs !== null) {
		player.dodgeElapsedMs += stepMs;
		if (moving) player.yaw = Math.atan2(moveX, moveZ);
		moveX = Math.sin(player.yaw);
		moveZ = Math.cos(player.yaw);
		moveWithCollision(
			state,
			world,
			moveX * DODGE_SPEED * seconds,
			moveZ * DODGE_SPEED * seconds,
		);
		player.locomotion = "dodge";
		if (player.dodgeElapsedMs >= 400) player.dodgeElapsedMs = null;
	} else {
		const sprinting =
			input.sprint &&
			moving &&
			player.stamina > 0 &&
			player.attackElapsedMs === null;
		const speed =
			player.attackElapsedMs === null
				? sprinting
					? RUN_SPEED
					: WALK_SPEED
				: 0;
		if (moving && speed > 0) {
			player.yaw = Math.atan2(moveX, moveZ);
			moveWithCollision(
				state,
				world,
				moveX * speed * seconds,
				moveZ * speed * seconds,
			);
		}
		player.stamina = clamp(
			player.stamina + (sprinting ? -24 : 18) * seconds,
			0,
			player.maxStamina,
		);
		player.locomotion = moving ? (sprinting ? "run" : "walk") : "idle";
	}

	if (input.jump && player.grounded && player.dodgeElapsedMs === null) {
		player.velocity.y = 8.5;
		player.grounded = false;
	}
	if (!player.grounded) {
		player.velocity.y -= 24 * seconds;
		player.position.y += player.velocity.y * seconds;
		if (player.position.y <= 0) {
			player.position.y = 0;
			player.velocity.y = 0;
			player.grounded = true;
		} else player.locomotion = player.velocity.y > 0 ? "jump" : "fall";
	}

	if (player.attackElapsedMs !== null) {
		player.attackElapsedMs += stepMs;
		player.locomotion = "attack";
		if (player.attackElapsedMs >= 150 && player.attackElapsedMs <= 310) {
			for (const enemy of state.enemies) {
				if (
					enemy.state === "defeated" ||
					player.attackHitEnemyIds.includes(enemy.id) ||
					distanceSquared(player.position, enemy.position) > ATTACK_RANGE ** 2
				)
					continue;
				const facingDelta = Math.abs(
					Math.atan2(
						Math.sin(angleTo(player.position, enemy.position) - player.yaw),
						Math.cos(angleTo(player.position, enemy.position) - player.yaw),
					),
				);
				if (facingDelta > 1.35 && player.lockOnEnemyId !== enemy.id) continue;
				enemy.hp = Math.max(0, enemy.hp - ATTACK_DAMAGE);
				enemy.state = enemy.hp === 0 ? "defeated" : "stagger";
				enemy.stateElapsedMs = 0;
				player.attackHitEnemyIds.push(enemy.id);
				events.push({
					type: "enemy-hit",
					enemyId: enemy.id,
					damage: ATTACK_DAMAGE,
				});
				if (enemy.hp === 0)
					events.push({ type: "enemy-defeated", enemyId: enemy.id });
			}
		}
		if (player.attackElapsedMs >= 520) {
			player.attackElapsedMs = null;
			player.attackHitEnemyIds = [];
		}
	}
};

const updateEnemy = (
	state: Action3dState,
	enemy: Action3dEnemyState,
	world: Action3dWorld,
	stepMs: number,
	events: Action3dEvent[],
) => {
	if (enemy.state === "defeated") return;
	const definition = world.enemies.find((item) => item.id === enemy.id);
	if (!definition) return;
	enemy.stateElapsedMs += stepMs;
	enemy.attackCooldownMs = Math.max(0, enemy.attackCooldownMs - stepMs);
	const distance = Math.sqrt(
		distanceSquared(enemy.position, state.player.position),
	);
	enemy.yaw = angleTo(enemy.position, state.player.position);
	if (enemy.state === "stagger") {
		if (enemy.stateElapsedMs >= 280) {
			enemy.state = "chase";
			enemy.stateElapsedMs = 0;
		}
		return;
	}
	if (enemy.state === "windup") {
		if (enemy.stateElapsedMs >= 440) {
			if (
				distance <= definition.attackRange + 0.5 &&
				state.player.invulnerableMs === 0
			) {
				state.player.hp = Math.max(0, state.player.hp - definition.damage);
				events.push({
					type: "player-hit",
					enemyId: enemy.id,
					damage: definition.damage,
				});
			}
			enemy.state = "recover";
			enemy.stateElapsedMs = 0;
			enemy.attackCooldownMs = 650;
		}
		return;
	}
	if (enemy.state === "recover") {
		if (enemy.stateElapsedMs >= 600) {
			enemy.state = "chase";
			enemy.stateElapsedMs = 0;
		}
		return;
	}
	if (distance <= definition.attackRange && enemy.attackCooldownMs === 0) {
		enemy.state = "windup";
		enemy.stateElapsedMs = 0;
		return;
	}
	if (distance < 15 && distance > definition.attackRange * 0.8) {
		enemy.state = "chase";
		const seconds = stepMs / 1000;
		enemy.position.x += Math.sin(enemy.yaw) * definition.moveSpeed * seconds;
		enemy.position.z += Math.cos(enemy.yaw) * definition.moveSpeed * seconds;
	} else enemy.state = "idle";
};

export function stepAction3dState(
	current: Action3dState,
	registry: Action3dContentRegistry,
	input: Action3dInput,
	stepMs: number,
): { state: Action3dState; events: Action3dEvent[] } {
	if (!Number.isFinite(stepMs) || stepMs <= 0)
		throw new Error("Action3D step must be a positive finite duration.");
	const state = cloneAction3dState(current);
	if (state.phase !== "playing") return { state, events: [] };
	const world = registry.getWorld(state.location.worldId);
	const events: Action3dEvent[] = [];
	state.revision += 1;
	state.elapsedMs += stepMs;
	updatePlayer(state, world, input, stepMs, events);
	for (const enemy of state.enemies)
		updateEnemy(state, enemy, world, stepMs, events);
	if (state.player.hp === 0) {
		state.phase = "defeat";
		state.player.locomotion = "defeated";
		events.push({ type: "defeat" });
	} else if (state.enemies.every((enemy) => enemy.state === "defeated")) {
		state.phase = "victory";
		state.location.checkpointId = world.victoryCheckpointId;
		events.push({ type: "victory", checkpointId: world.victoryCheckpointId });
	}
	return { state, events };
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
	stable.player.attackElapsedMs = null;
	stable.player.attackHitEnemyIds = [];
	stable.player.dodgeElapsedMs = null;
	stable.player.dodgeCooldownMs = 0;
	stable.player.invulnerableMs = 0;
	stable.player.lockOnEnemyId = null;
	if (stable.phase === "defeat") stable.phase = "playing";
	return stable;
}
