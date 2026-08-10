import { describe, expect, it } from "vitest";
import {
	createInitialFieldState,
	createFieldStateAt,
	FIELD_EVENT_TILE,
	isFieldWall,
	moveFieldParty,
} from "./field-engine";

describe("field engine", () => {
	it("creates a following party at a checkpoint", () => {
		expect(createFieldStateAt({ x: 1, y: 4 })).toEqual({
			partyPositions: [
				{ x: 1, y: 4 },
				{ x: 0, y: 4 },
				{ x: 0, y: 4 },
			],
			eventTriggered: false,
		});
	});
	it("moves the leader and makes the party follow without mutating input", () => {
		const state = createInitialFieldState();
		const transition = moveFieldParty(state, "UP");

		expect(state.partyPositions[0]).toEqual({ x: 3, y: 6 });
		expect(transition.moved).toBe(true);
		expect(transition.state.partyPositions).toEqual([
			{ x: 3, y: 5 },
			{ x: 3, y: 6 },
			{ x: 2, y: 6 },
		]);
	});

	it("blocks the outer boundary and ruin walls", () => {
		const boundaryState = createInitialFieldState();
		boundaryState.partyPositions[0] = { x: 1, y: 1 };
		const boundary = moveFieldParty(boundaryState, "UP");
		expect(boundary).toEqual({
			state: boundaryState,
			moved: false,
			eventTriggered: false,
		});

		const ruinState = createInitialFieldState();
		ruinState.partyPositions[0] = { x: 7, y: 4 };
		expect(isFieldWall({ x: 8, y: 4 })).toBe(true);
		expect(moveFieldParty(ruinState, "RIGHT").moved).toBe(false);
	});

	it("triggers the story event once and freezes further movement", () => {
		const state = createInitialFieldState();
		state.partyPositions[0] = { x: FIELD_EVENT_TILE.x - 1, y: FIELD_EVENT_TILE.y };
		const triggered = moveFieldParty(state, "RIGHT");

		expect(triggered.eventTriggered).toBe(true);
		expect(triggered.state.eventTriggered).toBe(true);
		expect(moveFieldParty(triggered.state, "LEFT")).toEqual({
			state: triggered.state,
			moved: false,
			eventTriggered: false,
		});
	});
});
