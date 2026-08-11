import { describe, expect, it, vi } from "vitest";
import { validateGameContentDirectory } from "../../scripts/validate-game-content";
import {
	createDemoBattleState,
	createDemoEncounterProvider,
	createInitialGameState,
	createSignalRuinsEncounterState,
} from "./demo-state";
import { createFieldStateAt } from "./field-engine";
import { GameSession, GameSessionError } from "./game-session";
import { GAME_STATE_SCHEMA_VERSION } from "./model";

const registry = validateGameContentDirectory();
const createState = (rngSeed = 42) =>
	createInitialGameState({ registry, rngSeed });
const createSession = (sessionId = "session-1") =>
	new GameSession({
		sessionId,
		initialState: createState(),
		registry,
		encounterProvider: createDemoEncounterProvider(),
	});
const createLineEvent = () => ({
	eventId: "signal-ruins-contact",
	nodeId: "mira-signal-line",
	status: "awaiting-confirm" as const,
	visibleLine: { speakerId: "mira", text: "A saved line." },
	choices: [],
	actors: [
		{ actorId: "mira", slot: "left" as const, expression: "focused" },
		{ actorId: "lune", slot: "right" as const, expression: "guarded" },
	],
});

describe("GameSession", () => {
	it("owns an isolated serializable content-compatible snapshot", () => {
		const initialState = createState();
		initialState.battle = createDemoBattleState(initialState.party.members);
		initialState.mode = "battle";
		const session = new GameSession({
			sessionId: "isolated",
			initialState,
			registry,
			encounterProvider: createDemoEncounterProvider(),
		});

		initialState.party.members[0].hp = 1;
		initialState.battle.party[0].hp = 1;
		const first = session.snapshot();
		first.location.checkpointId = "changed";
		first.field.partyPositions[0].x = 99;
		first.party.members[0].ability.name = "Changed";
		first.story.flags.changed = true;
		if (first.battle) first.battle.enemies[0].ability.name = "Changed";

		const second = session.snapshot();
		expect(second.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
		expect(second.contentVersion).toBe(registry.contentVersion);
		expect(second.rng).toEqual({ seed: 42, state: 42, draws: 0 });
		expect(second.location.checkpointId).toBe("signal-entry");
		expect(second.field.partyPositions[0]).toEqual({ x: 8, y: 18 });
		expect(second.party.members[0].ability.name).toBe("Arc Slash");
		expect(second.story.flags).toEqual({});
		expect(second.battle?.enemies[0].ability.name).toBe("Ember");
		expect(JSON.parse(JSON.stringify(second))).toEqual(second);
	});

	it("validates the content references in initial state", () => {
		const incompatible = createState();
		incompatible.contentVersion = "other-world";
		expect(
			() =>
				new GameSession({
					sessionId: "bad-version",
					initialState: incompatible,
					registry,
					encounterProvider: createDemoEncounterProvider(),
				}),
		).toThrow("incompatible");

		for (const mutate of [
			(state: ReturnType<typeof createState>) => {
				state.location.mapId = "missing-map";
			},
			(state: ReturnType<typeof createState>) => {
				state.location.entranceId = "missing-entrance";
			},
			(state: ReturnType<typeof createState>) => {
				state.location.checkpointId = "missing-checkpoint";
			},
			(state: ReturnType<typeof createState>) => {
				state.event = {
					eventId: "missing-event",
					nodeId: "node",
					status: "running",
					visibleLine: null,
					choices: [],
					actors: [],
				};
			},
		]) {
			const state = createState();
			mutate(state);
			expect(
				() =>
					new GameSession({
						sessionId: "bad-reference",
						initialState: state,
						registry,
						encounterProvider: createDemoEncounterProvider(),
					}),
			).toThrow(GameSessionError);
		}
		expect(
			() =>
				new GameSession({
					sessionId: " ",
					initialState: createState(),
					registry,
					encounterProvider: createDemoEncounterProvider(),
				}),
		).toThrow("must not be empty");
	});

	it.each<[
		string,
		(state: ReturnType<typeof createState>) => void,
	]>([
		[
			"party position count",
			(state) => {
				state.field.partyPositions.pop();
			},
		],
		["fractional x position", (state) => (state.field.partyPositions[0].x = 1.5)],
		["fractional y position", (state) => (state.field.partyPositions[0].y = 1.5)],
		["negative x position", (state) => (state.field.partyPositions[0].x = -1)],
		["negative y position", (state) => (state.field.partyPositions[0].y = -1)],
		["overflowing x position", (state) => (state.field.partyPositions[0].x = 40)],
		["overflowing y position", (state) => (state.field.partyPositions[0].y = 24)],
		["negative encounter steps", (state) => (state.field.stepsSinceEncounter = -1)],
		[
			"collision position",
			(state) => (state.field.partyPositions[0] = { x: 18, y: 10 }),
		],
		["unknown party actor", (state) => (state.party.members[0].id = "nova")],
		[
			"party actor without progression content",
			(state) => {
				state.party.members[0].id = "narrator";
				state.party.equipment.narrator = state.party.equipment.mira;
				delete state.party.equipment.mira;
			},
		],
		[
			"unknown party ability",
			(state) => {
				state.party.members[0].ability.id = "missing-ability";
				state.party.members[0].abilities[0].id = "missing-ability";
			},
		],
		[
			"unknown inventory item",
			(state) => {
				state.party.inventory["missing-item"] = 1;
			},
		],
		[
			"unknown equipment inventory item",
			(state) => {
				state.party.equipmentInventory["missing-equipment"] = 1;
			},
		],
		[
			"missing equipment loadout",
			(state) => {
				delete state.party.equipment.mira;
			},
		],
		[
			"equipment in an invalid slot",
			(state) => {
				state.party.equipment.mira.armor = "rune-blade";
			},
		],
		[
			"unknown pending trigger",
			(state) => (state.field.pendingTriggerId = "missing-trigger"),
		],
		[
			"pending trigger at a wrong x coordinate",
			(state) => (state.field.pendingTriggerId = "dormant-signal"),
		],
		[
			"pending trigger at a wrong y coordinate",
			(state) => {
				state.field.pendingTriggerId = "dormant-signal";
				state.field.partyPositions = [
					{ x: 31, y: 5 },
					{ x: 30, y: 5 },
					{ x: 29, y: 5 },
				];
			},
		],
		[
			"unknown encounter",
			(state) => {
				state.mode = "battle";
				state.battle = { ...createDemoBattleState(), id: "missing-encounter" };
			},
		],
		[
			"unknown event",
			(state) => {
				state.mode = "event";
				state.event = { ...createLineEvent(), eventId: "missing-event" };
			},
		],
		[
			"unknown event node",
			(state) => {
				state.mode = "event";
				state.event = { ...createLineEvent(), nodeId: "missing-node" };
			},
		],
		[
			"confirm status on a choice node",
			(state) => {
				state.mode = "event";
				state.event = {
					...createLineEvent(),
					eventId: "relay-camp-council",
					nodeId: "choose-relay-plan",
					actors: [
						{ actorId: "mira", slot: "left", expression: "resolved" },
						{ actorId: "sol", slot: "center", expression: "restless" },
						{ actorId: "lune", slot: "right", expression: "watchful" },
					],
				};
			},
		],
		[
			"choice status on a line node",
			(state) => {
				state.mode = "event";
				state.event = {
					...createLineEvent(),
					status: "awaiting-choice",
					choices: [{ id: "saved-choice", text: "Saved choice" }],
				};
			},
		],
		[
			"missing event actor state",
			(state) => {
				state.mode = "event";
				state.event = { ...createLineEvent(), actors: [] };
			},
		],
		[
			"mismatched event actor state",
			(state) => {
				state.mode = "event";
				state.event = {
					...createLineEvent(),
					actors: [
						{ actorId: "mira", slot: "left", expression: "focused" },
						{ actorId: "sol", slot: "right", expression: "guarded" },
					],
				};
			},
		],
		[
			"unknown visible speaker",
			(state) => {
				state.mode = "event";
				state.event = {
					...createLineEvent(),
					visibleLine: { speakerId: "nova", text: "Unknown speaker" },
				};
			},
		],
		[
			"unknown saved choice",
			(state) => {
				state.mode = "event";
				state.event = {
					eventId: "relay-camp-council",
					nodeId: "choose-relay-plan",
					status: "awaiting-choice",
					visibleLine: { speakerId: "narrator", text: "Choose." },
					choices: [{ id: "missing-choice", text: "Missing" }],
					actors: [
						{ actorId: "mira", slot: "left", expression: "resolved" },
						{ actorId: "sol", slot: "center", expression: "restless" },
						{ actorId: "lune", slot: "right", expression: "watchful" },
					],
				};
			},
		],
	])("rejects incompatible initial state with %s", (_label, mutate) => {
		const state = createState();
		mutate(state);
		expect(
			() =>
				new GameSession({
					sessionId: "incompatible-state",
					initialState: state,
					registry,
					encounterProvider: createDemoEncounterProvider(),
				}),
		).toThrow(GameSessionError);
	});

	it("accepts a pending trigger only at the leader position", () => {
		const state = createState();
		state.field.pendingTriggerId = "dormant-signal";
		state.field.partyPositions = [
			{ x: 31, y: 4 },
			{ x: 30, y: 4 },
			{ x: 29, y: 4 },
		];
		expect(
			new GameSession({
				sessionId: "pending-trigger",
				initialState: state,
				registry,
				encounterProvider: createDemoEncounterProvider(),
			}).snapshot().field.pendingTriggerId,
		).toBe("dormant-signal");
	});

	it("handles story state, relationships, and checkpoints", () => {
		const session = createSession();
		const flag = session.dispatch({
			type: "story.flag.set",
			flagId: "signal-contacted",
			value: true,
		});
		expect(flag.events[0].event).toMatchObject({
			type: "story.flag.changed",
			previousValue: null,
		});
		expect(
			session.dispatch({
				type: "story.flag.set",
				flagId: "signal-contacted",
				value: true,
			}).events,
		).toEqual([]);
		const prototypeNamedFlag = session.dispatch({
			type: "story.flag.set",
			flagId: "constructor",
			value: true,
		});
		expect(prototypeNamedFlag.state.story.flags.constructor).toBe(true);
		expect(Object.hasOwn(prototypeNamedFlag.state.story.flags, "constructor")).toBe(
			true,
		);
		expect(() =>
			session.dispatch({
				type: "story.flag.set",
				flagId: "__proto__",
				value: true,
			}),
		).toThrow("stable kebab-case ID");

		const relationship = session.dispatch({
			type: "story.relationship.adjust",
			relationshipId: "mira:nova",
			amount: 150,
		});
		expect(relationship.state.story.relationships["mira:nova"]).toBe(100);
		expect(relationship.events[0].event).toMatchObject({
			type: "story.relationship.changed",
			previousValue: 0,
			value: 100,
		});
		expect(
			session.dispatch({
				type: "story.relationship.adjust",
				relationshipId: "mira:nova",
				amount: 1,
			}).events,
		).toEqual([]);
		expect(
			session.dispatch({
				type: "story.relationship.adjust",
				relationshipId: "mira:nova",
				amount: 0,
			}).events,
		).toEqual([]);

		const checkpoint = session.dispatch({
			type: "checkpoint.reached",
			checkpointId: "signal-core",
		});
		expect(checkpoint.state.location.checkpointId).toBe("signal-core");
		expect(checkpoint.events[0].event).toEqual({
			type: "checkpoint.reached",
			mapId: "signal-ruins",
			previousCheckpointId: "signal-entry",
			checkpointId: "signal-core",
		});
		expect(
			session.dispatch({
				type: "checkpoint.reached",
				checkpointId: "signal-core",
			}).events[0]?.event,
		).toEqual({
			type: "checkpoint.reached",
			mapId: "signal-ruins",
			previousCheckpointId: "signal-core",
			checkpointId: "signal-core",
		});
		expect(() =>
			session.dispatch({
				type: "checkpoint.reached",
				checkpointId: "missing",
			}),
		).toThrow("has no checkpoint");
	});

	it("resolves field event triggers through dialogue, battle, and checkpoint atomically", () => {
		const state = createState();
		state.field = createFieldStateAt({ x: 30, y: 4 }, "RIGHT");
		const session = new GameSession({
			sessionId: "story-flow",
			initialState: state,
			registry,
			encounterProvider: createDemoEncounterProvider(),
		});
		const moved = session.dispatch({ type: "field.move", direction: "RIGHT" });
		expect(moved.events.map(({ event }) => event.type)).toEqual([
			"field.moved",
			"field.triggered",
		]);
		expect(moved.state.field.pendingTriggerId).toBe("dormant-signal");
		expect(session.dispatch({ type: "field.move", direction: "LEFT" }).events).toEqual(
			[],
		);

		const started = session.dispatch({ type: "field.trigger.resolve" });
		expect(started.state.mode).toBe("event");
		expect(started.state.field.pendingTriggerId).toBeNull();
		expect(started.state.event?.visibleLine?.speakerId).toBe("mira");
		session.dispatch({ type: "event.advance" });
		const battleStarted = session.dispatch({ type: "event.advance" });
		expect(battleStarted.state.mode).toBe("battle");
		expect(battleStarted.state.event?.nodeId).toBe("mark-ruins-cleared");

		const won = battleStarted.state.battle;
		if (!won) throw new Error("Expected battle state.");
		won.phase = "victory";
		won.party[0].hp = 61;
		for (const enemy of won.enemies) enemy.hp = 0;
		session.dispatch({ type: "battle.start", battle: won });
		const completed = session.dispatch({ type: "battle.complete" });
		expect(completed.state).toMatchObject({
			mode: "field",
			location: { checkpointId: "signal-core" },
			story: { flags: { "signal-ruins-cleared": true } },
			battle: null,
			event: null,
		});
		expect(completed.state.party.members[0].hp).toBe(71);
		expect(completed.events.map(({ event }) => event.type)).toEqual([
			"party.experience.gained",
			"party.level.gained",
			"party.ability.learned",
			"party.experience.gained",
			"party.level.gained",
			"party.ability.learned",
			"party.experience.gained",
			"party.level.gained",
			"party.ability.learned",
			"party.reward.received",
			"battle.completed",
			"mode.changed",
			"story.flag.changed",
			"checkpoint.reached",
			"event.completed",
			"mode.changed",
		]);
	});

	it("starts deterministic random encounters only after the safe-step window", () => {
		const session = createSession("random-encounter");
		for (let step = 1; step <= 14; step += 1) {
			const moved = session.dispatch({ type: "field.move", direction: "RIGHT" });
			expect(moved.state.mode).toBe("field");
			expect(moved.state.field.stepsSinceEncounter).toBe(step);
		}

		const encountered = session.dispatch({
			type: "field.move",
			direction: "RIGHT",
		});
		expect(encountered.state).toMatchObject({
			mode: "battle",
			field: { stepsSinceEncounter: 0 },
			battle: { id: "signal-ruins-roamers" },
			rng: { seed: 42, draws: 2 },
		});
		expect(encountered.events.map(({ event }) => event.type)).toEqual([
			"field.moved",
			"field.random-encounter",
			"mode.changed",
			"battle.started",
		]);
	});

	it("keeps the field formation valid when reversing after a random encounter", () => {
		const session = createSession("post-encounter-reverse");
		for (let step = 0; step < 15; step += 1) {
			session.dispatch({ type: "field.move", direction: "RIGHT" });
		}
		const endedBattle = session.snapshot().battle;
		if (!endedBattle) throw new Error("Expected a random encounter.");
		endedBattle.phase = "victory";
		for (const enemy of endedBattle.enemies) enemy.hp = 0;
		session.dispatch({ type: "battle.start", battle: endedBattle });
		session.dispatch({ type: "battle.complete" });

		const moved = session.dispatch({ type: "field.move", direction: "LEFT" });
		const positionKeys = moved.state.field.partyPositions.map(
			({ x, y }) => `${x},${y}`,
		);
		expect(moved.state.mode).toBe("field");
		expect(new Set(positionKeys).size).toBe(positionKeys.length);
	});

	it("fully restores the party at the spring and resets encounter steps", () => {
		const state = createState();
		state.party.members[0].hp = 12;
		state.party.members[1].hp = 30;
		state.field = createFieldStateAt({ x: 8, y: 15 }, "UP");
		state.field.stepsSinceEncounter = 13;
		const session = new GameSession({
			sessionId: "restoring-spring",
			initialState: state,
			registry,
			encounterProvider: createDemoEncounterProvider(),
		});

		const moved = session.dispatch({ type: "field.move", direction: "UP" });
		expect(moved.state.field).toMatchObject({
			pendingTriggerId: "restoring-spring",
			stepsSinceEncounter: 13,
		});
		expect(moved.events.at(-1)?.event).toMatchObject({
			type: "field.triggered",
			triggerId: "restoring-spring",
			kind: "recovery",
		});

		const recovered = session.dispatch({ type: "field.trigger.resolve" });
		expect(recovered.state.party.members.map(({ hp, maxHp }) => [hp, maxHp])).toEqual(
			[
				[72, 72],
				[58, 58],
				[64, 64],
			],
		);
		expect(recovered.state.field).toMatchObject({
			pendingTriggerId: null,
			stepsSinceEncounter: 0,
		});
		expect(recovered.events).toHaveLength(1);
		expect(recovered.events[0].event).toEqual({
			type: "party.recovered",
			triggerId: "restoring-spring",
			restoredHp: 88,
			restoredMp: 0,
		});
	});

	it("uses field items and changes equipment through session commands", () => {
		const state = createState();
		state.party.members[0].hp = 10;
		const session = new GameSession({
			sessionId: "party-menu-actions",
			initialState: state,
			registry,
			encounterProvider: createDemoEncounterProvider(registry),
		});

		const itemUsed = session.dispatch({
			type: "party.item.use",
			itemId: "potion",
			targetId: "mira",
		});
		expect(itemUsed.state.party.members[0].hp).toBe(60);
		expect(itemUsed.state.party.inventory.potion).toBe(4);
		expect(itemUsed.events[0].event).toEqual({
			type: "party.item.used",
			itemId: "potion",
			targetId: "mira",
			amount: 50,
		});

		const equipped = session.dispatch({
			type: "party.equipment.change",
			actorId: "mira",
			slot: "weapon",
			equipmentId: "tempered-blade",
		});
		expect(equipped.state.party.members[0].attack).toBe(25);
		expect(equipped.state.party.equipment.mira.weapon).toBe("tempered-blade");
		expect(equipped.state.party.equipmentInventory["rune-blade"]).toBe(1);
		expect(equipped.events[0].event).toEqual({
			type: "party.equipment.changed",
			actorId: "mira",
			slot: "weapon",
			previousEquipmentId: "rune-blade",
			equipmentId: "tempered-blade",
		});
	});

	it("enters the second map and applies a choice plus persistent reaction", () => {
		const state = createState();
		state.story.flags["signal-ruins-cleared"] = true;
		state.field = createFieldStateAt({ x: 33, y: 3 }, "RIGHT");
		const session = new GameSession({
			sessionId: "relay-flow",
			initialState: state,
			registry,
			encounterProvider: createDemoEncounterProvider(),
		});
		session.dispatch({ type: "field.move", direction: "RIGHT" });
		const entered = session.dispatch({ type: "field.trigger.resolve" });
		expect(entered.state).toMatchObject({
			location: {
				mapId: "relay-camp",
				entranceId: "ruins-gate",
				checkpointId: "relay-gate",
			},
		});
		expect(entered.state.field.partyPositions[0]).toEqual({ x: 2, y: 5 });
		expect(entered.events.some(({ event }) => event.type === "map.entered")).toBe(
			true,
		);

		session.dispatch({ type: "event.start", eventId: "relay-camp-council" });
		session.dispatch({ type: "event.advance" });
		const choices = session.dispatch({ type: "event.advance" });
		expect(choices.state.event?.status).toBe("awaiting-choice");
		const selected = session.dispatch({
			type: "event.choose",
			choiceId: "support-mira",
		});
		expect(selected.state).toMatchObject({
			mode: "field",
			location: { mapId: "relay-camp", checkpointId: "relay-center" },
			story: {
				flags: {
					"relay-plan-mira": true,
					"relay-council-complete": true,
				},
				relationships: { "mira:sol": 10 },
			},
		});
		const reaction = session.dispatch({
			type: "event.start",
			eventId: "relay-camp-reaction",
		});
		expect(reaction.state.event?.visibleLine?.speakerId).toBe("mira");
		session.dispatch({ type: "event.advance" });
		expect(session.snapshot().mode).toBe("field");
		session.snapshot().field.partyPositions[0].x = 2;
		const returnState = session.snapshot();
		returnState.field = createFieldStateAt({ x: 2, y: 5 }, "LEFT");
		const returnSession = new GameSession({
			sessionId: "relay-return",
			initialState: returnState,
			registry,
			encounterProvider: createDemoEncounterProvider(),
		});
		returnSession.dispatch({ type: "field.move", direction: "LEFT" });
		const returned = returnSession.dispatch({ type: "field.trigger.resolve" });
		expect(returned.state.location).toMatchObject({
			mapId: "signal-ruins",
			entranceId: "relay-return",
		});
	});

	it("owns battle progression, retry, commands, and standalone completion", () => {
		const session = createSession("battle-flow");
		const battle = createDemoBattleState(session.snapshot().party.members);
		battle.party[0].actionGauge = 1_000;
		battle.party[0].hp = 64;
		battle.enemies[0].hp = 1;
		battle.enemies[1].hp = 0;
		battle.phase = "awaiting-command";
		battle.activeActorId = "mira";
		session.dispatch({ type: "battle.start", battle });
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
		const completed = session.dispatch({ type: "battle.complete" });
		expect(completed.state.party.members[0].hp).toBe(74);
		expect(completed.state.mode).toBe("field");

		const partialVictory = createDemoBattleState(
			session.snapshot().party.members,
		);
		partialVictory.phase = "victory";
		for (const enemy of partialVictory.enemies) enemy.hp = 0;
		partialVictory.party = partialVictory.party.slice(0, 1);
		expect(() =>
			session.dispatch({ type: "battle.start", battle: partialVictory }),
		).toThrow(
			"Battle party identity and order must match the persistent party",
		);

		const running = createSignalRuinsEncounterState(
			session.snapshot().party.members,
		);
		session.dispatch({ type: "battle.start", battle: running });
		expect(() => session.dispatch({ type: "battle.complete" })).toThrow(
			"ended battle",
		);
		expect(session.dispatch({ type: "battle.tick", deltaMs: 1 }).events).toEqual(
			[],
		);
		const ticked = session.dispatch({ type: "battle.tick", deltaMs: 10_000 });
		expect(ticked.state.battle?.phase).toBe("awaiting-command");

		const defeat = createDemoBattleState(session.snapshot().party.members);
		defeat.phase = "defeat";
		for (const member of defeat.party) member.hp = 0;
		session.dispatch({ type: "battle.start", battle: defeat });
		const retried = session.dispatch({ type: "battle.retry" });
		expect(retried.state.battle?.phase).toBe("running");
		expect(retried.events.at(-1)?.event).toEqual({
			type: "battle.started",
			battleId: "signal-ruins-encounter",
		});
	});

	it("rejects incompatible commands without partially mutating state", () => {
		const session = createSession("invalid-commands");
		expect(() =>
			session.dispatch({
				type: "story.relationship.adjust",
				relationshipId: "invalid",
				amount: 1,
			}),
		).toThrow("separated by a colon");
		expect(() =>
			session.dispatch({
				type: "party.item.use",
				itemId: "potion",
				targetId: "mira",
			}),
		).toThrow("cannot be used");
		expect(() =>
			session.dispatch({
				type: "party.equipment.change",
				actorId: "mira",
				slot: "weapon",
				equipmentId: "rune-blade",
			}),
		).toThrow("cannot be equipped");
		expect(() =>
			session.dispatch({ type: "field.trigger.resolve" }),
		).toThrow("pending field trigger");
		expect(() => session.dispatch({ type: "event.advance" })).toThrow(
			"active event",
		);
		expect(() =>
			session.dispatch({ type: "event.start", eventId: "missing-event" }),
		).toThrow("unknown event");
		session.dispatch({
			type: "event.start",
			eventId: "signal-ruins-contact",
		});
		expect(() =>
			session.dispatch({
				type: "checkpoint.reached",
				checkpointId: "signal-core",
			}),
		).toThrow("field mode");
		expect(() =>
			session.dispatch({
				type: "party.item.use",
				itemId: "potion",
				targetId: "mira",
			}),
		).toThrow("field mode");
		expect(() =>
			session.dispatch({
				type: "party.equipment.change",
				actorId: "mira",
				slot: "weapon",
				equipmentId: null,
			}),
		).toThrow("field mode");
		expect(() =>
			session.dispatch({
				type: "event.start",
				eventId: "relay-camp-council",
			}),
		).toThrow("already active");
		expect(() =>
			session.dispatch({ type: "field.move", direction: "UP" }),
		).toThrow("field mode");
		expect(() =>
			session.dispatch({
				type: "battle.start",
				battle: createDemoBattleState(),
			}),
		).toThrow("active event");
		expect(() => session.dispatch({ type: "battle.tick", deltaMs: 1 })).toThrow(
			"active battle",
		);
		expect(() =>
			session.dispatch({
				type: "battle.command",
				command: { type: "defend", actorId: "mira" },
			}),
		).toThrow("active battle");
		expect(() => session.dispatch({ type: "battle.complete" })).toThrow(
			"ended battle",
		);
		expect(() => session.dispatch({ type: "battle.retry" })).toThrow(
			"defeated battle",
		);

		const badProvider = new GameSession({
			sessionId: "bad-provider",
			initialState: (() => {
				const state = createState();
				state.field = createFieldStateAt({ x: 30, y: 4 }, "RIGHT");
				return state;
			})(),
			registry,
			encounterProvider: () => ({ ...createDemoBattleState(), id: "wrong" }),
		});
		badProvider.dispatch({ type: "field.move", direction: "RIGHT" });
		badProvider.dispatch({ type: "field.trigger.resolve" });
		badProvider.dispatch({ type: "event.advance" });
		const revision = badProvider.revision;
		expect(() => badProvider.dispatch({ type: "event.advance" })).toThrow(
			"Encounter provider returned",
		);
		expect(badProvider.revision).toBe(revision);
		expect(badProvider.snapshot().mode).toBe("event");
	});

	it("rejects invalid battle providers and completes defeat and escape cleanup", () => {
		const unknownBattleSession = createSession("unknown-battle");
		const unknownBattle = createDemoBattleState(
			unknownBattleSession.snapshot().party.members,
		);
		unknownBattle.id = "missing-encounter";
		expect(() =>
			unknownBattleSession.dispatch({ type: "battle.start", battle: unknownBattle }),
		).toThrow("unknown encounter");

		const duringBattle = createSession("event-during-battle");
		duringBattle.dispatch({
			type: "battle.start",
			battle: createDemoBattleState(duringBattle.snapshot().party.members),
		});
		expect(() =>
			duringBattle.dispatch({
				type: "event.start",
				eventId: "signal-ruins-contact",
			}),
		).toThrow("during an active battle");
		expect(
			duringBattle.dispatch({ type: "battle.tick", deltaMs: 0 }).events,
		).toEqual([]);

		const defeatedState = createState();
		defeatedState.mode = "battle";
		defeatedState.battle = createDemoBattleState(defeatedState.party.members);
		defeatedState.battle.phase = "defeat";
		for (const member of defeatedState.battle.party) member.hp = 0;
		const badRetry = new GameSession({
			sessionId: "bad-retry-provider",
			initialState: defeatedState,
			registry,
			encounterProvider: () => ({
				...createDemoBattleState(defeatedState.party.members),
				id: "wrong",
			}),
		});
		expect(() => badRetry.dispatch({ type: "battle.retry" })).toThrow(
			"Encounter provider returned",
		);

		const defeatSession = new GameSession({
			sessionId: "complete-defeat",
			initialState: defeatedState,
			registry,
			encounterProvider: createDemoEncounterProvider(),
		});
		expect(defeatSession.dispatch({ type: "battle.complete" }).state.mode).toBe(
			"field",
		);

		const escapedState = createState();
		escapedState.mode = "battle";
		escapedState.battle = createDemoBattleState(escapedState.party.members);
		escapedState.battle.phase = "escaped";
		escapedState.battle.items = [
			{
				id: "potion",
				name: "Potion",
				description: "Potion",
				effect: "restore-hp",
				power: 50,
				statusIds: [],
				target: "ally-single",
				count: 0,
			},
		];
		const escapedSession = new GameSession({
			sessionId: "complete-escape",
			initialState: escapedState,
			registry,
			encounterProvider: createDemoEncounterProvider(),
		});
		const escaped = escapedSession.dispatch({ type: "battle.complete" });
		expect(escaped.state.mode).toBe("field");
		expect(escaped.state.party.inventory.potion).toBeUndefined();
	});

	it("rejects an invalid battle returned through a command without committing it", () => {
		const session = createSession("invalid-battle-state");
		const before = session.snapshot();
		const battle = createDemoBattleState(before.party.members);
		battle.phase = "awaiting-command";
		battle.activeActorId = "ghost";

		expect(() =>
			session.dispatch({ type: "battle.start", battle }),
		).toThrow("Awaiting-command battles require one living, ready party actor");
		expect(session.revision).toBe(before.revision);
		expect(session.snapshot().battle).toBeNull();
	});

	it("publishes lifecycle transitions until unsubscribed or closed", () => {
		const session = createSession("lifecycle");
		const listener = vi.fn();
		const unsubscribe = session.subscribe(listener);
		session.dispatch({
			type: "story.flag.set",
			flagId: "lifecycle-started",
			value: true,
		});
		const paused = session.pause();
		expect(paused).toMatchObject({
			sequence: 2,
			stateRevision: 1,
			event: { type: "session.paused" },
		});
		expect(session.pause()).toBeNull();
		expect(() =>
			session.dispatch({
				type: "story.flag.set",
				flagId: "while-paused",
				value: true,
			}),
		).toThrow(GameSessionError);
		unsubscribe();
		expect(session.resume()?.event).toEqual({ type: "session.resumed" });
		expect(session.resume()).toBeNull();
		const closeListener = vi.fn();
		session.subscribe(closeListener);
		expect(session.close()?.event).toEqual({ type: "session.closed" });
		expect(closeListener).toHaveBeenCalledOnce();
		expect(session.close()).toBeNull();
		expect(() => session.pause()).toThrow("closed session");
		expect(() => session.resume()).toThrow("closed session");
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it("isolates listener and diagnostics failures after committing once", () => {
		const listenerErrorSink = vi.fn(() => {
			throw new Error("diagnostics failed");
		});
		const session = new GameSession({
			sessionId: "listener-isolation",
			initialState: createState(),
			registry,
			encounterProvider: createDemoEncounterProvider(),
			listenerErrorSink,
		});
		const laterListener = vi.fn();
		session.subscribe(() => {
			throw new Error("listener failed");
		});
		session.subscribe(laterListener);

		expect(() =>
			session.dispatch({
				type: "story.flag.set",
				flagId: "listener-isolated",
				value: true,
			}),
		).not.toThrow();
		expect(session.revision).toBe(1);
		expect(session.snapshot().story.flags["listener-isolated"]).toBe(true);
		expect(laterListener).toHaveBeenCalledOnce();
		expect(listenerErrorSink).toHaveBeenCalledWith(expect.any(Error), {
			sessionId: "listener-isolation",
			sequence: 1,
			stateRevision: 1,
		});
	});

	it("notifies selector subscriptions only when their selected value changes", () => {
		const session = createSession("selector");
		const listener = vi.fn();
		const unsubscribe = session.subscribeSelector(
			(state) => state.mode,
			listener,
		);

		session.dispatch({
			type: "story.flag.set",
			flagId: "selector-unrelated",
			value: true,
		});
		expect(listener).not.toHaveBeenCalled();
		session.dispatch({
			type: "event.start",
			eventId: "signal-ruins-contact",
		});
		expect(listener).toHaveBeenCalledOnce();
		expect(listener).toHaveBeenCalledWith(
			"event",
			"field",
			expect.objectContaining({ state: expect.objectContaining({ mode: "event" }) }),
		);
		unsubscribe();
	});
});
