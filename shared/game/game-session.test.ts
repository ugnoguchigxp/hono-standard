import { describe, expect, it } from "vitest";
import {
	createDemoBattleState,
	createInitialGameState,
	createSignalRuinsEncounterState,
} from "./demo-state";
import { GameSession, GameSessionError } from "./game-session";
import { GAME_CONTENT_VERSION, GAME_STATE_SCHEMA_VERSION } from "./model";

const createSession = () =>
	new GameSession({
		sessionId: "session-1",
		initialState: createInitialGameState({ rngSeed: 42 }),
	});

describe("GameSession", () => {
	it("owns an isolated serializable snapshot", () => {
		const initialState = createInitialGameState({ rngSeed: 42 });
		initialState.battle = createDemoBattleState();
		const session = new GameSession({
			sessionId: "session-1",
			initialState,
		});

		initialState.party.members[0].hp = 1;
		initialState.rng.state = 99;
		initialState.battle.party[0].hp = 1;
		const firstSnapshot = session.snapshot();
		firstSnapshot.currentMap.checkpoint.x = 99;
		firstSnapshot.party.members[0].ability.name = "Changed";
		firstSnapshot.story.flags.changed = true;
		if (firstSnapshot.battle) {
			firstSnapshot.battle.enemies[0].ability.name = "Changed";
		}

		const secondSnapshot = session.snapshot();
		expect(secondSnapshot.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
		expect(secondSnapshot.contentVersion).toBe(GAME_CONTENT_VERSION);
		expect(secondSnapshot.revision).toBe(0);
		expect(secondSnapshot.rng).toEqual({ seed: 42, state: 42, draws: 0 });
		expect(secondSnapshot.currentMap.checkpoint.x).toBe(3);
		expect(secondSnapshot.party.members[0]).toMatchObject({
			hp: 72,
			ability: { name: "Arc Slash" },
		});
		expect(secondSnapshot.story.flags).toEqual({});
		expect(secondSnapshot.battle?.party[0].hp).toBe(72);
		expect(secondSnapshot.battle?.enemies[0].ability.name).toBe("Ember");
		expect(JSON.parse(JSON.stringify(secondSnapshot))).toEqual(secondSnapshot);
	});

	it("changes modes through commands and ignores no-ops", () => {
		const session = createSession();
		const changed = session.dispatch({ type: "mode.enter", mode: "event" });

		expect(changed.state.mode).toBe("event");
		expect(changed.state.revision).toBe(1);
		expect(changed.events).toEqual([
			{
				sessionId: "session-1",
				sequence: 1,
				stateRevision: 1,
				event: {
					type: "mode.changed",
					previousMode: "field",
					mode: "event",
				},
			},
		]);

		const noOp = session.dispatch({ type: "mode.enter", mode: "event" });
		expect(noOp.events).toEqual([]);
		expect(noOp.state.revision).toBe(1);
		expect(session.sequence).toBe(1);
	});

	it("records checkpoints without sharing command references", () => {
		const session = createSession();
		const checkpoint = { x: 7, y: 8 };
		const changed = session.dispatch({
			type: "checkpoint.reached",
			mapId: "lower-signal-ruins",
			checkpoint,
		});
		checkpoint.x = 99;

		expect(changed.events[0].event).toEqual({
			type: "checkpoint.reached",
			previousMapId: "signal-ruins",
			previousCheckpoint: { x: 3, y: 6 },
			mapId: "lower-signal-ruins",
			checkpoint: { x: 7, y: 8 },
		});
		expect(session.snapshot().currentMap).toEqual({
			id: "lower-signal-ruins",
			checkpoint: { x: 7, y: 8 },
		});

		expect(
			session.dispatch({
				type: "checkpoint.reached",
				mapId: "lower-signal-ruins",
				checkpoint: { x: 7, y: 8 },
			}),
		).toMatchObject({ events: [], state: { revision: 1 } });

		expect(
			session.dispatch({
				type: "checkpoint.reached",
				mapId: "lower-signal-ruins",
				checkpoint: { x: 9, y: 8 },
			}).state.currentMap.checkpoint,
		).toEqual({ x: 9, y: 8 });
		expect(
			session.dispatch({
				type: "checkpoint.reached",
				mapId: "lower-signal-ruins",
				checkpoint: { x: 9, y: 10 },
			}).state.currentMap.checkpoint,
		).toEqual({ x: 9, y: 10 });
	});

	it("sets story flags and reports their previous value", () => {
		const session = createSession();
		const first = session.dispatch({
			type: "story.flag.set",
			flagId: "signal-awakened",
			value: true,
		});
		expect(first.events[0].event).toEqual({
			type: "story.flag.changed",
			flagId: "signal-awakened",
			previousValue: null,
			value: true,
		});

		const noOp = session.dispatch({
			type: "story.flag.set",
			flagId: "signal-awakened",
			value: true,
		});
		expect(noOp.events).toEqual([]);

		const changed = session.dispatch({
			type: "story.flag.set",
			flagId: "signal-awakened",
			value: false,
		});
		expect(changed.events[0].event).toMatchObject({
			previousValue: true,
			value: false,
		});
		expect(changed.state.story.flags["signal-awakened"]).toBe(false);
	});

	it("moves the field party through the session authority", () => {
		const session = createSession();
		const moved = session.dispatch({ type: "field.move", direction: "UP" });
		expect(moved.state.field.partyPositions).toEqual([
			{ x: 3, y: 5 },
			{ x: 3, y: 6 },
			{ x: 2, y: 6 },
		]);
		expect(moved.events[0].event).toEqual({
			type: "field.moved",
			partyPositions: moved.state.field.partyPositions,
			eventTriggered: false,
		});

		const state = createInitialGameState();
		state.field.partyPositions[0] = { x: 1, y: 1 };
		const blockedSession = new GameSession({
			sessionId: "blocked",
			initialState: state,
		});
		expect(
			blockedSession.dispatch({ type: "field.move", direction: "UP" }),
		).toMatchObject({ events: [], state: { revision: 0 } });

		session.dispatch({ type: "mode.enter", mode: "event" });
		expect(() =>
			session.dispatch({ type: "field.move", direction: "UP" }),
		).toThrow("field mode");
	});

	it("does not retrigger the completed Signal Ruins event", () => {
		const state = createInitialGameState();
		state.story.flags["signal-ruins-cleared"] = true;
		state.field.partyPositions[0] = { x: 13, y: 5 };
		const session = new GameSession({
			sessionId: "cleared",
			initialState: state,
		});
		const moved = session.dispatch({ type: "field.move", direction: "RIGHT" });
		expect(moved.state.field.eventTriggered).toBe(false);
		expect(moved.events[0].event).toMatchObject({
			type: "field.moved",
			eventTriggered: false,
		});
	});

	it("owns battle start, progression, command, and completion", () => {
		const session = createSession();
		const battle = createDemoBattleState(session.snapshot().party.members);
		battle.party[0].actionGauge = 1_000;
		battle.party[0].hp = 61;
		battle.enemies[0].hp = 1;
		battle.enemies[1].hp = 0;
		battle.phase = "awaiting-command";
		battle.activeActorId = "mira";

		const started = session.dispatch({ type: "battle.start", battle });
		expect(started.state.mode).toBe("battle");
		expect(started.events.map(({ event }) => event.type)).toEqual([
			"mode.changed",
			"battle.started",
		]);
		battle.party[0].hp = 1;
		expect(session.snapshot().battle?.party[0].hp).toBe(61);

		const acted = session.dispatch({
			type: "battle.command",
			command: {
				type: "ability",
				actorId: "mira",
				targetId: "ash-wisp",
				abilityId: "arc-slash",
			},
		});
		expect(acted.state.battle?.phase).toBe("victory");
		expect(
			acted.events.some(
				({ event }) =>
					event.type === "battle.event" &&
					event.battleEvent.type === "battle.ended",
			),
		).toBe(true);

		const completed = session.dispatch({ type: "battle.complete" });
		expect(completed.state.mode).toBe("field");
		expect(completed.state.battle).toBeNull();
		expect(completed.state.party.members[0]).toMatchObject({
			id: "mira",
			hp: 61,
		});
		expect(completed.state.field.eventTriggered).toBe(false);
		expect(completed.events.map(({ event }) => event.type)).toEqual([
			"battle.completed",
			"mode.changed",
		]);
	});

	it("ticks active battles and can complete defeat without persisting battle HP", () => {
		const session = createSession();
		const battle = createSignalRuinsEncounterState(
			session.snapshot().party.members,
		);
		session.dispatch({ type: "battle.start", battle });
		const restarted = session.dispatch({ type: "battle.start", battle });
		expect(restarted.events.map(({ event }) => event.type)).toEqual([
			"battle.started",
		]);
		const quietTick = session.dispatch({ type: "battle.tick", deltaMs: 1 });
		expect(quietTick.events).toEqual([]);
		const ticked = session.dispatch({ type: "battle.tick", deltaMs: 10_000 });
		expect(ticked.state.battle?.elapsedMs).toBe(10_001);
		expect(ticked.state.battle?.phase).toBe("awaiting-command");
		expect(ticked.events[0].event.type).toBe("battle.event");

		const invalidTick = session.dispatch({
			type: "battle.tick",
			deltaMs: 0,
		});
		expect(invalidTick.events).toEqual([]);

		const defeatedState = createInitialGameState();
		const defeat = createDemoBattleState();
		defeat.phase = "defeat";
		defeat.party[0].hp = 0;
		defeatedState.mode = "battle";
		defeatedState.battle = defeat;
		const defeatedSession = new GameSession({
			sessionId: "defeat",
			initialState: defeatedState,
		});
		const completed = defeatedSession.dispatch({ type: "battle.complete" });
		expect(completed.state.party.members[0].hp).toBe(72);
		expect(completed.events[0].event).toEqual({
			type: "battle.completed",
			result: "defeat",
		});
	});

	it("keeps persistent party members missing from a completed encounter", () => {
		const state = createInitialGameState();
		const battle = createDemoBattleState();
		battle.phase = "victory";
		battle.party = battle.party.slice(0, 1);
		state.mode = "battle";
		state.battle = battle;
		const session = new GameSession({ sessionId: "partial", initialState: state });
		const completed = session.dispatch({ type: "battle.complete" });
		expect(completed.state.party.members[1].hp).toBe(58);
	});

	it("rejects battle operations without a compatible active battle", () => {
		const session = createSession();
		expect(() =>
			session.dispatch({ type: "battle.tick", deltaMs: 1 }),
		).toThrow("active battle");
		expect(() =>
			session.dispatch({
				type: "battle.command",
				command: { type: "defend", actorId: "mira" },
			}),
		).toThrow("active battle");
		expect(() =>
			session.dispatch({ type: "battle.complete" }),
		).toThrow("ended battle");

		const running = createDemoBattleState();
		session.dispatch({ type: "battle.start", battle: running });
		expect(() =>
			session.dispatch({ type: "battle.complete" }),
		).toThrow("ended battle");
	});

	it("publishes semantic transitions until unsubscribed or closed", () => {
		const session = createSession();
		const transitions: string[][] = [];
		const unsubscribe = session.subscribe((transition) => {
			transitions.push(transition.events.map(({ event }) => event.type));
		});
		session.dispatch({ type: "mode.enter", mode: "event" });
		session.pause();
		unsubscribe();
		session.resume();
		expect(transitions).toEqual([["mode.changed"], ["session.paused"]]);

		let closeEvents = 0;
		session.subscribe(() => {
			closeEvents += 1;
		});
		session.close();
		expect(closeEvents).toBe(1);
	});

	it("tracks lifecycle events without changing state revision", () => {
		const session = createSession();
		const paused = session.pause();
		expect(paused).toMatchObject({
			sequence: 1,
			stateRevision: 0,
			event: { type: "session.paused" },
		});
		expect(session.status).toBe("paused");
		expect(session.pause()).toBeNull();
		expect(() =>
			session.dispatch({ type: "mode.enter", mode: "event" }),
		).toThrow(GameSessionError);

		const resumed = session.resume();
		expect(resumed).toMatchObject({
			sequence: 2,
			stateRevision: 0,
			event: { type: "session.resumed" },
		});
		expect(session.resume()).toBeNull();
		session.dispatch({ type: "mode.enter", mode: "event" });

		const closed = session.close();
		expect(closed).toMatchObject({
			sequence: 4,
			stateRevision: 1,
			event: { type: "session.closed" },
		});
		expect(session.close()).toBeNull();
		expect(session.status).toBe("closed");
		expect(session.revision).toBe(1);
		expect(session.sequence).toBe(4);
		expect(() => session.pause()).toThrow("closed session");
		expect(() => session.resume()).toThrow("closed session");
		expect(() =>
			session.dispatch({ type: "mode.enter", mode: "field" }),
		).toThrow("current status is closed");
	});

	it("rejects invalid identifiers and checkpoint coordinates", () => {
		expect(
			() =>
				new GameSession({
					sessionId: "  ",
					initialState: createInitialGameState(),
				}),
		).toThrow("Session ID");

		const session = createSession();
		expect(() =>
			session.dispatch({
				type: "checkpoint.reached",
				mapId: "",
				checkpoint: { x: 0, y: 0 },
			}),
		).toThrow("Map ID");
		expect(() =>
			session.dispatch({
				type: "checkpoint.reached",
				mapId: "map",
				checkpoint: { x: -1, y: 0 },
			}),
		).toThrow("Checkpoint x");
		expect(() =>
			session.dispatch({
				type: "checkpoint.reached",
				mapId: "map",
				checkpoint: { x: 0, y: 1.5 },
			}),
		).toThrow("Checkpoint y");
		expect(() =>
			session.dispatch({
				type: "story.flag.set",
				flagId: " ",
				value: true,
			}),
		).toThrow("Story flag ID");
	});
});
