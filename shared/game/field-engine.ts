import type { MapDefinitionV1, MapTriggerV1 } from "./content";
import { evaluateContentCondition } from "./content";
import type {
	FieldDirection,
	FieldState,
	GridPoint,
	StoryState,
} from "./model";

export type FieldTransition = {
	state: FieldState;
	moved: boolean;
	trigger: MapTriggerV1 | null;
};

const directionOffsets: Record<FieldDirection, GridPoint> = {
	UP: { x: 0, y: -1 },
	DOWN: { x: 0, y: 1 },
	LEFT: { x: -1, y: 0 },
	RIGHT: { x: 1, y: 0 },
};

const copyFieldState = (state: FieldState): FieldState => ({
	partyPositions: state.partyPositions.map((position) => ({ ...position })),
	facing: state.facing,
	pendingTriggerId: state.pendingTriggerId,
	stepsSinceEncounter: state.stepsSinceEncounter,
});

export function createFieldStateAt(
	position: GridPoint,
	facing: FieldDirection,
	partySize = 3,
): FieldState {
	const offset = directionOffsets[facing];
	return {
		partyPositions: Array.from({ length: partySize }, (_, index) => ({
			x: Math.max(0, position.x - offset.x * index),
			y: Math.max(0, position.y - offset.y * index),
		})),
		facing,
		pendingTriggerId: null,
		stepsSinceEncounter: 0,
	};
}

export function moveFieldParty(
	state: FieldState,
	direction: FieldDirection,
	map: MapDefinitionV1,
	story: Pick<StoryState, "flags" | "relationships">,
	isCollision: (point: GridPoint) => boolean,
): FieldTransition {
	if (state.pendingTriggerId) {
		return { state, moved: false, trigger: null };
	}
	const leader = state.partyPositions[0];
	const offset = directionOffsets[direction];
	const nextLeader = { x: leader.x + offset.x, y: leader.y + offset.y };
	if (
		nextLeader.x < 0 ||
		nextLeader.y < 0 ||
		nextLeader.x >= map.width ||
		nextLeader.y >= map.height ||
		isCollision(nextLeader)
	) {
		return { state, moved: false, trigger: null };
	}

	const trigger =
		map.triggers.find(
			(candidate) =>
				candidate.position.x === nextLeader.x &&
				candidate.position.y === nextLeader.y &&
				evaluateContentCondition(candidate.condition, story),
		) ?? null;
	const next = copyFieldState(state);
	next.partyPositions = [nextLeader, ...next.partyPositions.slice(0, -1)];
	next.facing = direction;
	next.pendingTriggerId = trigger?.id ?? null;
	return { state: next, moved: true, trigger };
}
