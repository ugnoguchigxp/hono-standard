import type {
	Action3dContentRegistry,
	Action3dEnemyArchetype,
	Action3dWorld,
} from "../content";
import type {
	Action3dEnemyState,
	Action3dEvent,
	Action3dProjectileState,
	Action3dState,
} from "../model";
import {
	angleTo,
	distanceSquared,
	hasLineOfSight,
	isBlocked,
} from "./world-query";

const spawnProjectile = (
	state: Action3dState,
	enemy: Action3dEnemyState,
	archetype: Action3dEnemyArchetype,
): Action3dProjectileState => {
	const yaw = angleTo(enemy.position, state.player.position);
	const speed = archetype.attack.projectileSpeed ?? 0;
	return {
		id: `projectile-${enemy.id}-${state.revision}`,
		ownerEnemyId: enemy.id,
		position: {
			x: enemy.position.x,
			y: enemy.position.y + 1,
			z: enemy.position.z,
		},
		velocity: { x: Math.sin(yaw) * speed, y: 0, z: Math.cos(yaw) * speed },
		radius: archetype.attack.projectileRadius ?? 0.25,
		damage: archetype.attack.damage,
		lifetimeMs: archetype.attack.projectileLifetimeMs ?? 1_000,
	};
};

export const updateAction3dEnemy = (
	state: Action3dState,
	enemy: Action3dEnemyState,
	registry: Action3dContentRegistry,
	world: Action3dWorld,
	stepMs: number,
	events: Action3dEvent[],
) => {
	if (enemy.state === "defeated") return;
	const archetype = registry.getEnemyArchetype(enemy.archetypeId);
	enemy.stateElapsedMs += stepMs;
	enemy.attackCooldownMs = Math.max(0, enemy.attackCooldownMs - stepMs);
	const distance = Math.sqrt(
		distanceSquared(enemy.position, state.player.position),
	);
	enemy.yaw = angleTo(enemy.position, state.player.position);
	if (enemy.state === "stagger") {
		if (enemy.stateElapsedMs >= archetype.staggerMs) {
			enemy.state = "chase";
			enemy.stateElapsedMs = 0;
		}
		return;
	}
	if (enemy.state === "windup") {
		if (enemy.stateElapsedMs >= archetype.attack.windupMs) {
			if (archetype.behavior === "ranged") {
				const projectile = spawnProjectile(state, enemy, archetype);
				state.projectiles.push(projectile);
				events.push({
					type: "projectile-spawned",
					projectileId: projectile.id,
					enemyId: enemy.id,
				});
			} else if (
				distance <= archetype.attack.range + 0.5 &&
				state.player.invulnerableMs === 0
			) {
				state.player.hp = Math.max(
					0,
					state.player.hp - archetype.attack.damage,
				);
				events.push({
					type: "player-hit",
					enemyId: enemy.id,
					damage: archetype.attack.damage,
				});
			}
			enemy.state = "recover";
			enemy.stateElapsedMs = 0;
			enemy.attackCooldownMs = archetype.attack.cooldownMs;
		}
		return;
	}
	if (enemy.state === "recover") {
		if (enemy.stateElapsedMs >= archetype.attack.recoveryMs) {
			enemy.state = "chase";
			enemy.stateElapsedMs = 0;
		}
		return;
	}
	const canAttack =
		distance <= archetype.attack.range &&
		enemy.attackCooldownMs === 0 &&
		hasLineOfSight(world, enemy.position, state.player.position);
	if (canAttack) {
		enemy.state = "windup";
		enemy.stateElapsedMs = 0;
		return;
	}
	if (distance < archetype.perceptionRange) {
		enemy.state = "chase";
		const seconds = stepMs / 1000;
		const direction =
			archetype.behavior === "ranged" &&
			distance < archetype.preferredRange * 0.65
				? -1
				: 1;
		const shouldMove =
			archetype.behavior === "melee"
				? distance > archetype.preferredRange
				: distance > archetype.preferredRange * 1.15 ||
					distance < archetype.preferredRange * 0.65;
		if (!shouldMove) {
			enemy.state = "idle";
			return;
		}
		const dx = Math.sin(enemy.yaw) * archetype.moveSpeed * seconds * direction;
		const dz = Math.cos(enemy.yaw) * archetype.moveSpeed * seconds * direction;
		const radius = registry.playerTuning.playerRadius;
		if (!isBlocked(world, enemy.position.x + dx, enemy.position.z, radius))
			enemy.position.x += dx;
		if (!isBlocked(world, enemy.position.x, enemy.position.z + dz, radius))
			enemy.position.z += dz;
	} else enemy.state = "idle";
};

export const updateAction3dProjectiles = (
	state: Action3dState,
	registry: Action3dContentRegistry,
	world: Action3dWorld,
	stepMs: number,
	events: Action3dEvent[],
) => {
	if (state.projectiles.length === 0) return;
	const seconds = stepMs / 1000;
	const survivors: Action3dProjectileState[] = [];
	for (const projectile of state.projectiles) {
		projectile.lifetimeMs -= stepMs;
		if (projectile.lifetimeMs <= 0) continue;
		const next = {
			x: projectile.position.x + projectile.velocity.x * seconds,
			y: projectile.position.y + projectile.velocity.y * seconds,
			z: projectile.position.z + projectile.velocity.z * seconds,
		};
		if (isBlocked(world, next.x, next.z, projectile.radius)) continue;
		projectile.position = next;
		const hitRadius = projectile.radius + registry.playerTuning.playerRadius;
		if (
			distanceSquared(projectile.position, state.player.position) <=
			hitRadius ** 2
		) {
			if (state.player.invulnerableMs === 0) {
				state.player.hp = Math.max(0, state.player.hp - projectile.damage);
				events.push({
					type: "player-hit",
					enemyId: projectile.ownerEnemyId,
					damage: projectile.damage,
				});
			}
			continue;
		}
		survivors.push(projectile);
	}
	state.projectiles = survivors;
};
