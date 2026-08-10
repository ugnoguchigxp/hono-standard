import type { FieldDirection, FieldState, GridPoint } from "./model";

export const FIELD_MAP_WIDTH = 20;
export const FIELD_MAP_HEIGHT = 12;
export const FIELD_EVENT_TILE = { x: 14, y: 5 } as const;

export type FieldTransition = {
	state: FieldState;
	moved: boolean;
	eventTriggered: boolean;
};

const wallTiles = new Set([
	...Array.from({ length: FIELD_MAP_WIDTH }, (_, x) => `${x},0`),
	...Array.from(
		{ length: FIELD_MAP_WIDTH },
		(_, x) => `${x},${FIELD_MAP_HEIGHT - 1}`,
	),
	...Array.from({ length: FIELD_MAP_HEIGHT - 2 }, (_, y) => `0,${y + 1}`),
	...Array.from(
		{ length: FIELD_MAP_HEIGHT - 2 },
		(_, y) => `${FIELD_MAP_WIDTH - 1},${y + 1}`,
	),
	"8,3",
	"8,4",
	"8,5",
	"11,6",
	"11,7",
	"11,8",
]);

const directionOffsets: Record<FieldDirection, GridPoint> = {
	UP: { x: 0, y: -1 },
	DOWN: { x: 0, y: 1 },
	LEFT: { x: -1, y: 0 },
	RIGHT: { x: 1, y: 0 },
};

export function createInitialFieldState(): FieldState {
	return {
		partyPositions: [
			{ x: 3, y: 6 },
			{ x: 2, y: 6 },
			{ x: 1, y: 6 },
		],
		eventTriggered: false,
	};
}

export function createFieldStateAt(checkpoint: GridPoint): FieldState {
	return {
		partyPositions: [
			{ ...checkpoint },
			{ x: Math.max(0, checkpoint.x - 1), y: checkpoint.y },
			{ x: Math.max(0, checkpoint.x - 2), y: checkpoint.y },
		],
		eventTriggered: false,
	};
}

export function isFieldWall(point: GridPoint): boolean {
	return wallTiles.has(`${point.x},${point.y}`);
}

export function moveFieldParty(
	state: FieldState,
	direction: FieldDirection,
): FieldTransition {
	if (state.eventTriggered) {
		return { state, moved: false, eventTriggered: false };
	}
	const leader = state.partyPositions[0];
	const offset = directionOffsets[direction];
	const nextLeader = { x: leader.x + offset.x, y: leader.y + offset.y };
	if (isFieldWall(nextLeader)) {
		return { state, moved: false, eventTriggered: false };
	}

	const eventTriggered =
		nextLeader.x === FIELD_EVENT_TILE.x && nextLeader.y === FIELD_EVENT_TILE.y;
	return {
		state: {
			partyPositions: [nextLeader, ...state.partyPositions.slice(0, -1)],
			eventTriggered,
		},
		moved: true,
		eventTriggered,
	};
}
