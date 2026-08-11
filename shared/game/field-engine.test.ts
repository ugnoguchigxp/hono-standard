import { describe, expect, it } from "vitest";
import { validateGameContentDirectory } from "../../scripts/validate-game-content";
import {
	createFieldStateAt,
	FieldPlacementError,
	moveFieldParty,
} from "./field-engine";

const registry = validateGameContentDirectory();
const signalRuins = registry.getMap("signal-ruins");
const emptyStory = { flags: {}, relationships: {} };
const move = (
	state: ReturnType<typeof createFieldStateAt>,
	direction: "UP" | "DOWN" | "LEFT" | "RIGHT",
	story = emptyStory,
) =>
	moveFieldParty(state, direction, signalRuins, story, (point) =>
		registry.isCollision(signalRuins.id, point.x, point.y),
	);

describe("field engine", () => {
	it("creates a following party from an entrance direction", () => {
		expect(createFieldStateAt({ x: 2, y: 5 }, "RIGHT")).toEqual({
			partyPositions: [
				{ x: 2, y: 5 },
				{ x: 1, y: 5 },
				{ x: 0, y: 5 },
			],
			facing: "RIGHT",
			pendingTriggerId: null,
			stepsSinceEncounter: 0,
		});
		expect(createFieldStateAt({ x: 2, y: 1 }, "UP", 2).partyPositions).toEqual([
			{ x: 2, y: 1 },
			{ x: 2, y: 2 },
		]);
	});

	it("finds a distinct walkable formation when the straight trail is blocked", () => {
		const blocked = new Set(["0,1", "1,2"]);
		const state = createFieldStateAt(
			{ x: 0, y: 2 },
			"RIGHT",
			4,
			(point) =>
				point.x >= 0 &&
				point.x < 3 &&
				point.y >= 0 &&
				point.y < 4 &&
				!blocked.has(`${point.x},${point.y}`),
		);

		expect(new Set(state.partyPositions.map(({ x, y }) => `${x},${y}`)).size).toBe(
			4,
		);
		expect(
			state.partyPositions.every(
				(point) =>
					point.x >= 0 &&
					point.x < 3 &&
					point.y >= 0 &&
					point.y < 4 &&
					!blocked.has(`${point.x},${point.y}`),
			),
		).toBe(true);
	});

	it("rejects entrances that cannot hold the requested party", () => {
		for (const partySize of [0, 9, 1.5]) {
			expect(() =>
				createFieldStateAt({ x: 0, y: 0 }, "RIGHT", partySize),
			).toThrow("Party size must be between");
		}
		expect(() =>
			createFieldStateAt({ x: 0, y: 0 }, "RIGHT", 1, () => false),
		).toThrow("leader position");
		expect(() =>
			createFieldStateAt({ x: 0, y: 0 }, "RIGHT", 2, (point) =>
				point.x === 0 && point.y === 0,
			),
		).toThrow(FieldPlacementError);
	});

	it("moves the leader and makes the party follow without mutating input", () => {
		const state = createFieldStateAt({ x: 5, y: 18 }, "RIGHT");
		const transition = move(state, "UP");

		expect(state.partyPositions[0]).toEqual({ x: 5, y: 18 });
		expect(transition.moved).toBe(true);
		expect(transition.state).toMatchObject({
			partyPositions: [
				{ x: 5, y: 17 },
				{ x: 5, y: 18 },
				{ x: 4, y: 18 },
			],
			facing: "UP",
		});
	});

	it("keeps every party position unique when the leader reverses into the formation", () => {
		const state = createFieldStateAt({ x: 26, y: 17 }, "RIGHT");
		const transition = move(state, "LEFT");

		expect(transition.moved).toBe(true);
		expect(transition.state.partyPositions).toEqual([
			{ x: 25, y: 17 },
			{ x: 26, y: 17 },
			{ x: 24, y: 17 },
		]);
		expect(
			new Set(
				transition.state.partyPositions.map(({ x, y }) => `${x},${y}`),
			).size,
		).toBe(transition.state.partyPositions.length);
	});

	it("blocks map boundaries and content collision regions", () => {
		const boundary = createFieldStateAt({ x: 1, y: 1 }, "RIGHT");
		expect(move(boundary, "UP")).toEqual({
			state: boundary,
			moved: false,
			trigger: null,
		});

		const ruinWall = createFieldStateAt({ x: 27, y: 10 }, "LEFT");
		expect(registry.isCollision("signal-ruins", 26, 10)).toBe(true);
		expect(move(ruinWall, "LEFT").moved).toBe(false);
		const outside = createFieldStateAt({ x: 0, y: 5 }, "LEFT");
		expect(move(outside, "LEFT").moved).toBe(false);
	});

	it("selects enabled triggers and freezes until they are resolved", () => {
		const state = createFieldStateAt({ x: 30, y: 4 }, "RIGHT");
		const triggered = move(state, "RIGHT");

		expect(triggered.trigger).toMatchObject({
			id: "dormant-signal",
			kind: "event",
		});
		expect(triggered.state.pendingTriggerId).toBe("dormant-signal");
		expect(move(triggered.state, "LEFT")).toEqual({
			state: triggered.state,
			moved: false,
			trigger: null,
		});

		const cleared = move(state, "RIGHT", {
			flags: { "signal-ruins-cleared": true },
			relationships: {},
		});
		expect(cleared.trigger).toBeNull();
		expect(cleared.state.pendingTriggerId).toBeNull();
	});
});
