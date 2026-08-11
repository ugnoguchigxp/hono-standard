export const GAME_IDS = {
	rpg2d: "echoes-at-dawn",
	action3d: "action-3d",
} as const;

export type GameId = (typeof GAME_IDS)[keyof typeof GAME_IDS];
