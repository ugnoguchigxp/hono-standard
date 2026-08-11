import type { FieldDirection, FieldState, GridPoint } from "./model";

export const MAX_FIELD_PARTY_SIZE = 8;

export class FieldPlacementError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "FieldPlacementError";
	}
}

const directionOffsets: Record<FieldDirection, GridPoint> = {
	UP: { x: 0, y: -1 },
	DOWN: { x: 0, y: 1 },
	LEFT: { x: -1, y: 0 },
	RIGHT: { x: 1, y: 0 },
};

export function createFieldStateAt(
	position: GridPoint,
	facing: FieldDirection,
	partySize = 3,
	isWalkable: (point: GridPoint) => boolean = (point) =>
		point.x >= 0 && point.y >= 0,
): FieldState {
	if (
		!Number.isSafeInteger(partySize) ||
		partySize < 1 ||
		partySize > MAX_FIELD_PARTY_SIZE
	) {
		throw new FieldPlacementError(
			`Party size must be between 1 and ${MAX_FIELD_PARTY_SIZE}.`,
		);
	}
	if (!isWalkable(position)) {
		throw new FieldPlacementError(
			`Party leader position '${position.x},${position.y}' is not walkable.`,
		);
	}

	const offset = directionOffsets[facing];
	const used = new Set([`${position.x},${position.y}`]);
	const partyPositions: GridPoint[] = [{ ...position }];
	const neighborOffsets = [
		{ x: -offset.x, y: -offset.y },
		{ x: -offset.y, y: offset.x },
		{ x: offset.y, y: -offset.x },
		{ x: offset.x, y: offset.y },
	];

	while (partyPositions.length < partySize) {
		const origin = partyPositions.at(-1) ?? position;
		const queue = [origin];
		const visited = new Set([`${origin.x},${origin.y}`]);
		let follower: GridPoint | null = null;
		for (let cursor = 0; cursor < queue.length && cursor < 512; cursor += 1) {
			const current = queue[cursor];
			for (const neighborOffset of neighborOffsets) {
				const candidate = {
					x: current.x + neighborOffset.x,
					y: current.y + neighborOffset.y,
				};
				const key = `${candidate.x},${candidate.y}`;
				if (visited.has(key)) continue;
				visited.add(key);
				if (!isWalkable(candidate)) continue;
				if (!used.has(key)) {
					follower = candidate;
					break;
				}
				queue.push(candidate);
			}
			if (follower) break;
		}
		if (!follower) {
			throw new FieldPlacementError(
				`No walkable formation is available for ${partySize} party members at '${position.x},${position.y}'.`,
			);
		}
		partyPositions.push(follower);
		used.add(`${follower.x},${follower.y}`);
	}

	return {
		partyPositions,
		facing,
		pendingTriggerId: null,
		stepsSinceEncounter: 0,
	};
}
