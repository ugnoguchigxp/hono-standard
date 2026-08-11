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
const MAX_STEP_HEIGHT = 0.45;
const MAX_SLOPE_GRADIENT = Math.tan(Math.PI / 4);
const ATTACK_DAMAGE = 40;
const ATTACK_RANGE = 2.35;
const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));
const approach = (current: number, target: number, maxDelta: number) =>
	current < target
		? Math.min(target, current + maxDelta)
		: Math.max(target, current - maxDelta);
const distanceSquared = (
	a: { x: number; z: number },
	b: { x: number; z: number },
) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const angleTo = (
	from: { x: number; z: number },
	to: { x: number; z: number },
) => Math.atan2(to.x - from.x, to.z - from.z);
const segmentIntersectsBounds = (
	from: { x: number; z: number },
	to: { x: number; z: number },
	bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
) => {
	const dx = to.x - from.x;
	const dz = to.z - from.z;
	let near = 0;
	let far = 1;
	for (const [origin, delta, min, max] of [
		[from.x, dx, bounds.minX, bounds.maxX],
		[from.z, dz, bounds.minZ, bounds.maxZ],
	] as const) {
		if (Math.abs(delta) < 0.000_01) {
			if (origin < min || origin > max) return false;
			continue;
		}
		const first = (min - origin) / delta;
		const second = (max - origin) / delta;
		near = Math.max(near, Math.min(first, second));
		far = Math.min(far, Math.max(first, second));
		if (near > far) return false;
	}
	return far >= 0 && near <= 1;
};
const hasLineOfSight = (
	world: Action3dWorld,
	from: { x: number; z: number },
	to: { x: number; z: number },
) =>
	!world.colliders.some((collider) =>
		segmentIntersectsBounds(from, to, collider.bounds),
	);
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
const groundAt = (world: Action3dWorld, x: number, z: number) => {
	let result: { height: number; gradient: number } = { height: 0, gradient: 0 };
	for (const surface of world.surfaces) {
		if (
			x < surface.bounds.minX ||
			x > surface.bounds.maxX ||
			z < surface.bounds.minZ ||
			z > surface.bounds.maxZ
		)
			continue;
		const span =
			surface.axis === "x"
				? surface.bounds.maxX - surface.bounds.minX
				: surface.bounds.maxZ - surface.bounds.minZ;
		const offset =
			surface.axis === "x" ? x - surface.bounds.minX : z - surface.bounds.minZ;
		const gradient = (surface.toHeight - surface.fromHeight) / span;
		const height = surface.fromHeight + gradient * offset;
		if (height >= result.height)
			result = { height, gradient: Math.abs(gradient) };
	}
	return result;
};
const moveWithCollision = (
	state: Action3dState,
	world: Action3dWorld,
	dx: number,
	dz: number,
) => {
	const currentGround = groundAt(
		world,
		state.player.position.x,
		state.player.position.z,
	).height;
	const canTraverse = (x: number, z: number) => {
		const ground = groundAt(world, x, z);
		return (
			ground.gradient <= MAX_SLOPE_GRADIENT &&
			ground.height - currentGround <= MAX_STEP_HEIGHT
		);
	};
	const nextX = state.player.position.x + dx;
	if (
		!isBlocked(world, nextX, state.player.position.z) &&
		canTraverse(nextX, state.player.position.z)
	)
		state.player.position.x = nextX;
	const nextZ = state.player.position.z + dz;
	if (
		!isBlocked(world, state.player.position.x, nextZ) &&
		canTraverse(state.player.position.x, nextZ)
	)
		state.player.position.z = nextZ;
	if (state.player.grounded) {
		const ground = groundAt(
			world,
			state.player.position.x,
			state.player.position.z,
		).height;
		if (ground < currentGround - MAX_STEP_HEIGHT) state.player.grounded = false;
		else state.player.position.y = ground;
	}
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
			attackComboIndex: 0,
			attackQueued: false,
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

const updateLockOn = (
	state: Action3dState,
	world: Action3dWorld,
	input: Action3dInput,
) => {
	const current = state.enemies.find(
		(enemy) => enemy.id === state.player.lockOnEnemyId,
	);
	if (
		state.player.lockOnEnemyId &&
		(!current ||
			current.state === "defeated" ||
			distanceSquared(current.position, state.player.position) > 144 ||
			!hasLineOfSight(world, state.player.position, current.position))
	)
		state.player.lockOnEnemyId = null;
	if (!input.lockOn) return;
	if (state.player.lockOnEnemyId) {
		state.player.lockOnEnemyId = null;
		return;
	}
	const targetScore = (enemy: Action3dEnemyState) => {
		const viewDelta = Math.abs(
			Math.atan2(
				Math.sin(
					angleTo(state.player.position, enemy.position) - input.cameraYaw,
				),
				Math.cos(
					angleTo(state.player.position, enemy.position) - input.cameraYaw,
				),
			),
		);
		return (
			distanceSquared(enemy.position, state.player.position) + viewDelta * 8
		);
	};
	const target = state.enemies
		.filter(
			(enemy) =>
				enemy.state !== "defeated" &&
				distanceSquared(enemy.position, state.player.position) <= 144 &&
				hasLineOfSight(world, state.player.position, enemy.position),
		)
		.sort((a, b) => targetScore(a) - targetScore(b))[0];
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
	updateLockOn(state, world, input);

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
	if (input.attack && player.dodgeElapsedMs === null) {
		if (player.attackElapsedMs === null) {
			player.attackElapsedMs = 0;
			player.attackComboIndex = 0;
			player.attackQueued = false;
			player.attackHitEnemyIds = [];
		} else if (player.attackElapsedMs >= 220) {
			player.attackQueued = true;
		}
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
		player.velocity.x = moveX * DODGE_SPEED;
		player.velocity.z = moveZ * DODGE_SPEED;
		moveWithCollision(
			state,
			world,
			player.velocity.x * seconds,
			player.velocity.z * seconds,
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
		}
		const acceleration = moving && speed > 0 ? 42 : 55;
		player.velocity.x = approach(
			player.velocity.x,
			moveX * speed,
			acceleration * seconds,
		);
		player.velocity.z = approach(
			player.velocity.z,
			moveZ * speed,
			acceleration * seconds,
		);
		moveWithCollision(
			state,
			world,
			player.velocity.x * seconds,
			player.velocity.z * seconds,
		);
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
		const ground = groundAt(world, player.position.x, player.position.z).height;
		if (player.position.y <= ground) {
			player.position.y = ground;
			player.velocity.y = 0;
			player.grounded = true;
		} else player.locomotion = player.velocity.y > 0 ? "jump" : "fall";
	}
	const lockTarget = state.enemies.find(
		(enemy) => enemy.id === player.lockOnEnemyId,
	);
	if (lockTarget && player.dodgeElapsedMs === null)
		player.yaw = angleTo(player.position, lockTarget.position);

	if (player.attackElapsedMs !== null) {
		player.attackElapsedMs += stepMs;
		player.locomotion = "attack";
		if (player.attackElapsedMs >= 150 && player.attackElapsedMs <= 310) {
			for (const enemy of state.enemies) {
				if (
					enemy.state === "defeated" ||
					player.attackHitEnemyIds.includes(enemy.id) ||
					distanceSquared(player.position, enemy.position) >
						ATTACK_RANGE ** 2 ||
					!hasLineOfSight(world, player.position, enemy.position)
				)
					continue;
				const facingDelta = Math.abs(
					Math.atan2(
						Math.sin(angleTo(player.position, enemy.position) - player.yaw),
						Math.cos(angleTo(player.position, enemy.position) - player.yaw),
					),
				);
				if (facingDelta > 1.35 && player.lockOnEnemyId !== enemy.id) continue;
				const damage = ATTACK_DAMAGE + player.attackComboIndex * 5;
				enemy.hp = Math.max(0, enemy.hp - damage);
				enemy.state = enemy.hp === 0 ? "defeated" : "stagger";
				enemy.stateElapsedMs = 0;
				player.attackHitEnemyIds.push(enemy.id);
				events.push({
					type: "enemy-hit",
					enemyId: enemy.id,
					damage,
				});
				if (enemy.hp === 0)
					events.push({ type: "enemy-defeated", enemyId: enemy.id });
			}
		}
		if (player.attackElapsedMs >= 520) {
			if (player.attackQueued && player.attackComboIndex < 2) {
				player.attackElapsedMs = 0;
				player.attackComboIndex += 1;
				player.attackQueued = false;
				player.attackHitEnemyIds = [];
			} else {
				player.attackElapsedMs = null;
				player.attackComboIndex = 0;
				player.attackQueued = false;
				player.attackHitEnemyIds = [];
			}
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
		const dx = Math.sin(enemy.yaw) * definition.moveSpeed * seconds;
		const dz = Math.cos(enemy.yaw) * definition.moveSpeed * seconds;
		if (!isBlocked(world, enemy.position.x + dx, enemy.position.z))
			enemy.position.x += dx;
		if (!isBlocked(world, enemy.position.x, enemy.position.z + dz))
			enemy.position.z += dz;
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
	stable.player.attackComboIndex = 0;
	stable.player.attackQueued = false;
	stable.player.attackHitEnemyIds = [];
	stable.player.dodgeElapsedMs = null;
	stable.player.dodgeCooldownMs = 0;
	stable.player.invulnerableMs = 0;
	stable.player.lockOnEnemyId = null;
	if (stable.phase === "defeat") stable.phase = "playing";
	return stable;
}
