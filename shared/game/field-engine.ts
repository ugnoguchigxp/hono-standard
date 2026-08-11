import type { MapDefinitionV1, MapTriggerV1 } from "./content";
import { evaluateContentCondition } from "./content";
import type {
	FieldDirection,
	FieldState,
	GridPoint,
	StoryState,
} from "./model";

export {
	createFieldStateAt,
	FieldPlacementError,
	MAX_FIELD_PARTY_SIZE,
} from "./field-placement";

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
	const partyPositions = [nextLeader];
	const occupiedPositions = new Set([`${nextLeader.x},${nextLeader.y}`]);
	for (const position of next.partyPositions) {
		if (partyPositions.length >= next.partyPositions.length) break;
		const key = `${position.x},${position.y}`;
		if (occupiedPositions.has(key)) continue;
		partyPositions.push(position);
		occupiedPositions.add(key);
	}
	next.partyPositions = partyPositions;
	next.facing = direction;
	next.pendingTriggerId = trigger?.id ?? null;
	return { state: next, moved: true, trigger };
}
