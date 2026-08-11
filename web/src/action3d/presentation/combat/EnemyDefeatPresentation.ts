export const ENEMY_DEFEAT_SETTLE_MS = 1_200;

const FINAL_FALL_RADIANS = 1.28;

export type EnemyDefeatPresentation = {
	progress: number;
	rotationZ: number;
	settled: boolean;
};

const smoothstep = (value: number) => value * value * (3 - 2 * value);

/**
 * Keeps the enemy's world transform authoritative while its skeleton supplies
 * the secondary collapse motion. This guarantees that a defeated model stays
 * down even when an imported one-shot animation is interrupted or unavailable.
 */
export const getEnemyDefeatPresentation = (
	elapsedMs: number,
	enemyIndex: number,
): EnemyDefeatPresentation => {
	const linearProgress = Math.min(
		1,
		Math.max(0, elapsedMs) / ENEMY_DEFEAT_SETTLE_MS,
	);
	const progress = smoothstep(linearProgress);
	const direction = enemyIndex % 2 === 0 ? 1 : -1;
	return {
		progress,
		rotationZ: direction * FINAL_FALL_RADIANS * progress,
		settled: linearProgress >= 1,
	};
};
