export type BattleSpritePosition = {
	x: number;
	y: number;
	scale: number;
};

const PARTY_POSITIONS: readonly BattleSpritePosition[] = [
	{ x: 272, y: 62, scale: 0.88 },
	{ x: 272, y: 94, scale: 0.88 },
	{ x: 272, y: 126, scale: 0.88 },
];

const ENEMY_POSITIONS: readonly BattleSpritePosition[] = [
	{ x: 76, y: 98, scale: 0.98 },
	{ x: 121, y: 112, scale: 0.96 },
];

export const battlePartyPosition = (index: number): BattleSpritePosition =>
	PARTY_POSITIONS[index] ?? {
		x: 272,
		y: 126 + (index - PARTY_POSITIONS.length + 1) * 28,
		scale: 0.88,
	};

export const battleEnemyPosition = (
	isBossBattle: boolean,
	index: number,
): BattleSpritePosition => {
	if (isBossBattle && index === 0) return { x: 92, y: 124, scale: 0.88 };
	return (
		ENEMY_POSITIONS[index] ?? {
			x: 42 + (index % 5) * 34,
			y: 84 + Math.floor(index / 5) * 30,
			scale: 0.92,
		}
	);
};
