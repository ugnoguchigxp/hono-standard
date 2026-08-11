import type {
	Action3dAttackDefinition,
	Action3dContentRegistry,
	Action3dWorld,
} from "../content";
import type {
	Action3dEnemyState,
	Action3dEvent,
	Action3dInput,
	Action3dState,
} from "../model";
import {
	angleTo,
	approach,
	clamp,
	distanceSquared,
	groundAt,
	hasLineOfSight,
	movePlayerWithCollision,
	normalizeMove,
} from "./world-query";

const FIRST_LIGHT_ATTACK_ID = "light-1";
const HEAVY_ATTACK_ID = "heavy-slash";

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

const startAttack = (
	state: Action3dState,
	attack: Action3dAttackDefinition,
) => {
	state.player.activeAttackId = attack.id;
	state.player.attackElapsedMs = 0;
	state.player.attackQueued = false;
	state.player.attackHitEnemyIds = [];
	state.player.attackComboIndex =
		attack.id === "light-2" ? 1 : attack.id === "light-3" ? 2 : 0;
	state.player.stamina -= attack.staminaCost;
};

export const updateAction3dPlayer = (
	state: Action3dState,
	registry: Action3dContentRegistry,
	world: Action3dWorld,
	input: Action3dInput,
	stepMs: number,
	events: Action3dEvent[],
) => {
	const player = state.player;
	const tuning = registry.playerTuning;
	const seconds = stepMs / 1000;
	player.dodgeCooldownMs = Math.max(0, player.dodgeCooldownMs - stepMs);
	player.invulnerableMs = Math.max(0, player.invulnerableMs - stepMs);
	updateLockOn(state, world, input);

	if (
		input.dodge &&
		player.grounded &&
		player.dodgeCooldownMs === 0 &&
		player.stamina >= tuning.dodgeStaminaCost &&
		player.attackElapsedMs === null
	) {
		player.dodgeElapsedMs = 0;
		player.dodgeCooldownMs = tuning.dodgeCooldownMs;
		player.invulnerableMs = tuning.dodgeInvulnerableMs;
		player.stamina -= tuning.dodgeStaminaCost;
	}
	if (player.dodgeElapsedMs === null) {
		if (player.attackElapsedMs === null) {
			const requested = input.heavyAttack
				? registry.getAttack(HEAVY_ATTACK_ID)
				: input.attack
					? registry.getAttack(FIRST_LIGHT_ATTACK_ID)
					: null;
			if (requested && player.stamina >= requested.staminaCost)
				startAttack(state, requested);
		} else if (input.attack && player.activeAttackId) {
			const current = registry.getAttack(player.activeAttackId);
			if (
				current.nextAttackId &&
				player.attackElapsedMs >= current.queueOpensMs
			)
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
		player.velocity.x = moveX * tuning.dodgeSpeed;
		player.velocity.z = moveZ * tuning.dodgeSpeed;
		movePlayerWithCollision(
			state,
			world,
			tuning,
			player.velocity.x * seconds,
			player.velocity.z * seconds,
		);
		player.locomotion = "dodge";
		if (player.dodgeElapsedMs >= tuning.dodgeDurationMs)
			player.dodgeElapsedMs = null;
	} else {
		const sprinting =
			input.sprint &&
			moving &&
			player.stamina > 0 &&
			player.attackElapsedMs === null;
		const speed =
			player.attackElapsedMs === null
				? sprinting
					? tuning.runSpeed
					: tuning.walkSpeed
				: 0;
		if (moving && speed > 0) player.yaw = Math.atan2(moveX, moveZ);
		const acceleration =
			moving && speed > 0 ? tuning.acceleration : tuning.deceleration;
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
		movePlayerWithCollision(
			state,
			world,
			tuning,
			player.velocity.x * seconds,
			player.velocity.z * seconds,
		);
		player.stamina = clamp(
			player.stamina +
				(sprinting
					? -tuning.staminaSprintPerSecond
					: player.attackElapsedMs === null
						? tuning.staminaRecoveryPerSecond
						: 0) *
					seconds,
			0,
			player.maxStamina,
		);
		player.locomotion = moving ? (sprinting ? "run" : "walk") : "idle";
	}

	if (input.jump && player.grounded && player.dodgeElapsedMs === null) {
		player.velocity.y = tuning.jumpSpeed;
		player.grounded = false;
	}
	if (!player.grounded) {
		player.velocity.y -= tuning.gravity * seconds;
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

	if (player.attackElapsedMs !== null && player.activeAttackId) {
		const attack = registry.getAttack(player.activeAttackId);
		player.attackElapsedMs += stepMs;
		player.locomotion = "attack";
		const activeEnd = attack.startupMs + attack.activeMs;
		if (
			player.attackElapsedMs >= attack.startupMs &&
			player.attackElapsedMs <= activeEnd
		) {
			for (const enemy of state.enemies) {
				if (
					enemy.state === "defeated" ||
					player.attackHitEnemyIds.includes(enemy.id) ||
					distanceSquared(player.position, enemy.position) >
						attack.range ** 2 ||
					!hasLineOfSight(world, player.position, enemy.position)
				)
					continue;
				const facingDelta = Math.abs(
					Math.atan2(
						Math.sin(angleTo(player.position, enemy.position) - player.yaw),
						Math.cos(angleTo(player.position, enemy.position) - player.yaw),
					),
				);
				if (
					facingDelta > attack.arcRadians / 2 &&
					player.lockOnEnemyId !== enemy.id
				)
					continue;
				enemy.hp = Math.max(0, enemy.hp - attack.damage);
				enemy.state = enemy.hp === 0 ? "defeated" : "stagger";
				enemy.stateElapsedMs = 0;
				player.attackHitEnemyIds.push(enemy.id);
				events.push({
					type: "enemy-hit",
					enemyId: enemy.id,
					damage: attack.damage,
				});
				if (enemy.hp === 0)
					events.push({ type: "enemy-defeated", enemyId: enemy.id });
			}
		}
		const total = activeEnd + attack.recoveryMs;
		if (player.attackElapsedMs >= total) {
			if (player.attackQueued && attack.nextAttackId) {
				startAttack(state, registry.getAttack(attack.nextAttackId));
			} else {
				player.activeAttackId = null;
				player.attackElapsedMs = null;
				player.attackComboIndex = 0;
				player.attackQueued = false;
				player.attackHitEnemyIds = [];
			}
		}
	}
};
