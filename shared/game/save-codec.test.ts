import { describe, expect, it } from "vitest";
import { validateGameContentDirectory } from "../../scripts/validate-game-content";
import { createDemoBattleState, createInitialGameState } from "./demo-state";
import {
	decodeGameSave,
	GAME_SAVE_FORMAT_VERSION,
	serializeGameSave,
} from "./save-codec";
import {
	GAME_CONTENT_VERSION,
	GAME_STATE_SCHEMA_VERSION,
	type GameState,
} from "./model";

const registry = validateGameContentDirectory();
const savedAt = "2026-08-10T00:00:00.000Z";
const currentState = () => createInitialGameState({ registry, rngSeed: 42 });
const lineEvent = (): NonNullable<GameState["event"]> => ({
	eventId: "signal-ruins-contact",
	nodeId: "mira-signal-line",
	status: "awaiting-confirm",
	visibleLine: { speakerId: "mira", text: "A saved line." },
	choices: [],
	actors: [
		{ actorId: "mira", slot: "left", expression: "focused" },
		{ actorId: "lune", slot: "right", expression: "guarded" },
	],
});

const toLegacyCharacter = (member: GameState["party"]["members"][number]) => ({
	id: member.id,
	name: member.name,
	level: member.level,
	hp: member.hp,
	maxHp: member.maxHp,
	attack: member.attack,
	defense: member.defense,
	speed: member.speed,
	ability: {
		id: member.ability.id,
		name: member.ability.name,
		powerPercent: member.ability.powerPercent,
	},
});

const toLegacyParty = (state: GameState) => ({
	members: state.party.members.map(toLegacyCharacter),
});

const toLegacyBattle = (state: GameState) =>
	state.battle
		? {
				id: state.battle.id,
				phase:
					state.battle.phase === "escaped" ? ("defeat" as const) : state.battle.phase,
				elapsedMs: state.battle.elapsedMs,
				activeActorId: state.battle.activeActorId,
				party: state.battle.party.map((member) => ({
					...toLegacyCharacter(member),
					side: member.side,
					actionGauge: member.actionGauge,
					defending: member.defending,
				})),
				enemies: state.battle.enemies.map((enemy) => ({
					...toLegacyCharacter(enemy),
					side: enemy.side,
					actionGauge: enemy.actionGauge,
					defending: enemy.defending,
				})),
			}
		: null;

const createLegacyV2State = (checkpoint = { x: 3, y: 6 }) => {
	const current = currentState();
	return {
		schemaVersion: 2,
		contentVersion: "signal-ruins-1",
		revision: current.revision,
		rng: current.rng,
		mode: current.mode,
		field: {
			partyPositions: current.field.partyPositions,
			eventTriggered: false,
		},
		currentMap: { id: "signal-ruins", checkpoint },
		party: toLegacyParty(current),
		story: current.story,
		battle: toLegacyBattle(current),
	};
};

const envelope = (state: unknown) => ({
	formatVersion: GAME_SAVE_FORMAT_VERSION,
	slotId: "autosave",
	savedAt,
	state,
});

describe("game save codec", () => {
	it("round-trips current field and active event states", () => {
		const state = currentState();
		state.story.flags["signal-contacted"] = true;
		state.mode = "event";
		state.event = {
			eventId: "signal-ruins-contact",
			nodeId: "mira-signal-line",
			status: "awaiting-confirm",
			visibleLine: { speakerId: "mira", text: "A saved line." },
			choices: [],
			actors: [
				{ actorId: "mira", slot: "left", expression: "focused" },
			],
		};
		const result = decodeGameSave(serializeGameSave(state, savedAt));

		expect(result.status).toBe("ready");
		if (result.status !== "ready") return;
		expect(result.migrated).toBe(false);
		expect(result.save).toEqual({
			formatVersion: GAME_SAVE_FORMAT_VERSION,
			slotId: "autosave",
			savedAt,
			state,
		});
	});

	it("migrates v2 entry and cleared checkpoints through v3 into v4", () => {
		for (const [checkpoint, checkpointId] of [
			[{ x: 3, y: 6 }, "signal-entry"],
			[{ x: 14, y: 5 }, "signal-core"],
		] as const) {
			const legacy = createLegacyV2State(checkpoint);
			legacy.story.flags["legacy-flag"] = true;
			const result = decodeGameSave(JSON.stringify(envelope(legacy)));
			expect(result.status).toBe("ready");
			if (result.status !== "ready") continue;
			expect(result.migrated).toBe(true);
			expect(result.save.state).toMatchObject({
				schemaVersion: GAME_STATE_SCHEMA_VERSION,
				contentVersion: GAME_CONTENT_VERSION,
				location: {
					mapId: "signal-ruins",
					entranceId: "signal-ruins-entry",
					checkpointId,
				},
				field: { facing: "RIGHT", pendingTriggerId: null },
				event: null,
			});
			expect(result.save.state.story.flags["legacy-flag"]).toBe(true);
		}
	});

	it("migrates a v3 state by adding serializable event state", () => {
		const current = currentState();
		const { event: _event, ...legacy } = current;
		const result = decodeGameSave(
			JSON.stringify(
					envelope({
						...legacy,
						schemaVersion: 3,
						contentVersion: "legacy-content",
						mode: "event",
						party: toLegacyParty(current),
						battle: toLegacyBattle(current),
				}),
			),
		);
		expect(result.status).toBe("ready");
		if (result.status !== "ready") return;
		expect(result.migrated).toBe(true);
		expect(result.save.state.event).toBeNull();
		expect(result.save.state.mode).toBe("field");
		expect(result.save.state.contentVersion).toBe("legacy-content");
	});

	it("loads current saves with a missing optional encounter step counter", () => {
		const state = currentState();
		const legacyField = { ...state.field } as Partial<typeof state.field>;
		delete legacyField.stepsSinceEncounter;
		const result = decodeGameSave(
			JSON.stringify(envelope({ ...state, field: legacyField })),
		);

		expect(result.status).toBe("ready");
		if (result.status !== "ready") return;
		expect(result.migrated).toBe(false);
		expect(result.save.state.field.stepsSinceEncounter).toBe(0);
	});

	it("migrates a v4 party into progression, inventory, and equipment state", () => {
		const state = currentState();
		const result = decodeGameSave(
			JSON.stringify(
				envelope({
					...state,
					schemaVersion: 4,
					party: toLegacyParty(state),
					battle: toLegacyBattle(state),
				}),
			),
		);

		expect(result.status).toBe("ready");
		if (result.status !== "ready") return;
		expect(result.migrated).toBe(true);
		expect(result.save.state.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
		expect(result.save.state.party.members[0]).toMatchObject({
			id: "mira",
			experience: 0,
			mp: 18,
			maxMp: 18,
		});
		expect(result.save.state.party.inventory).toMatchObject({
			potion: 5,
			ether: 3,
		});
		expect(result.save.state.party.equipment.mira.weapon).toBe("rune-blade");
	});

	it("migrates current v4 members and battles without degrading their data", () => {
		const state = currentState();
		state.mode = "battle";
		state.battle = createDemoBattleState(state.party.members);
		const result = decodeGameSave(
			JSON.stringify(envelope({ ...state, schemaVersion: 4 })),
		);

		expect(result).toMatchObject({
			status: "ready",
			migrated: true,
			save: {
				state: {
					mode: "battle",
					battle: { items: state.battle.items },
				},
			},
		});
	});

	it("migrates active legacy battles, non-level-one guests, and inventory items", () => {
		for (const battleId of ["signal-ruins-encounter", "random-encounter"]) {
			const state = currentState();
			state.mode = "battle";
			state.battle = createDemoBattleState(state.party.members);
			state.battle.id = battleId;
			const legacyParty = toLegacyParty(state);
			legacyParty.members[0].level = 2;
			const legacyBattle = toLegacyBattle(state);
			if (legacyBattle) legacyBattle.party[0].level = 2;
			const { event: _event, ...withoutEvent } = state;
			const result = decodeGameSave(
				JSON.stringify(
					envelope({
						...withoutEvent,
						schemaVersion: 3,
						party: legacyParty,
						battle: legacyBattle,
					}),
				),
			);
			expect(result).toMatchObject({ status: "ready", migrated: true });
			if (result.status !== "ready") continue;
			expect(result.save.state.mode).toBe("battle");
			expect(result.save.state.party.members[0].experience).toBe(100);
			expect(result.save.state.battle).toMatchObject({
				canEscape: battleId !== "signal-ruins-encounter",
				items: [{ id: "potion", count: 5 }],
			});
		}

		const guestState = currentState();
		const guestParty = toLegacyParty(guestState);
		guestParty.members[0].id = "guest";
		const guest = decodeGameSave(
			JSON.stringify(
				envelope({
					...guestState,
					schemaVersion: 4,
					party: guestParty,
					battle: null,
				}),
			),
		);
		expect(guest).toMatchObject({
			status: "ready",
			save: {
				state: {
					party: {
						equipment: {
							guest: {
								weapon: null,
								armor: null,
								"off-hand": null,
								relic: null,
							},
						},
					},
				},
			},
		});
	});

	it("normalizes battle mode without a battle during v3 migration", () => {
		const state = currentState();
		const { event: _event, ...legacy } = state;
		const result = decodeGameSave(
			JSON.stringify(
				envelope({
					...legacy,
					schemaVersion: 3,
					mode: "battle",
					party: toLegacyParty(state),
					battle: null,
				}),
			),
		);
		expect(result).toMatchObject({
			status: "ready",
			save: { state: { mode: "field", battle: null } },
		});
	});


	it.each<[
		string,
		(state: ReturnType<typeof currentState>) => void,
	]>([
		["field mode with event", (state) => (state.event = lineEvent())],
		[
			"field mode with battle",
			(state) => (state.battle = createDemoBattleState()),
		],
		["event mode without event", (state) => (state.mode = "event")],
		[
			"event mode with battle",
			(state) => {
				state.mode = "event";
				state.event = lineEvent();
				state.battle = createDemoBattleState();
			},
		],
		["battle mode without battle", (state) => (state.mode = "battle")],
		[
			"running event outside battle",
			(state) => {
				state.mode = "event";
				state.event = { ...lineEvent(), status: "running", visibleLine: null };
			},
		],
		[
			"battle-suspended confirm event",
			(state) => {
				state.mode = "battle";
				state.battle = createDemoBattleState();
				state.event = lineEvent();
			},
		],
		[
			"confirm event without visible line",
			(state) => {
				state.mode = "event";
				state.event = { ...lineEvent(), visibleLine: null };
			},
		],
		[
			"confirm event with choices",
			(state) => {
				state.mode = "event";
				state.event = {
					...lineEvent(),
					choices: [{ id: "unexpected", text: "Unexpected" }],
				};
			},
		],
		[
			"choice event without prompt",
			(state) => {
				state.mode = "event";
				state.event = {
					...lineEvent(),
					status: "awaiting-choice",
					visibleLine: null,
				};
			},
		],
		[
			"choice event without choices",
			(state) => {
				state.mode = "event";
				state.event = {
					...lineEvent(),
					status: "awaiting-choice",
				};
			},
		],
		[
			"running event with a visible line",
			(state) => {
				state.mode = "battle";
				state.battle = createDemoBattleState();
				state.event = { ...lineEvent(), status: "running" };
			},
		],
		[
			"running event with choices",
			(state) => {
				state.mode = "battle";
				state.battle = createDemoBattleState();
				state.event = {
					...lineEvent(),
					status: "running",
					visibleLine: null,
					choices: [{ id: "unexpected", text: "Unexpected" }],
				};
			},
		],
		[
			"battle HP above maximum",
			(state) => {
				state.mode = "battle";
				state.battle = createDemoBattleState(state.party.members);
				state.battle.party[0].hp = state.battle.party[0].maxHp + 1;
			},
		],
		[
			"battle actor on the wrong side",
			(state) => {
				state.mode = "battle";
				state.battle = createDemoBattleState(state.party.members);
				state.battle.party[0].side = "enemy";
			},
		],
		[
			"unknown active battle actor",
			(state) => {
				state.mode = "battle";
				state.battle = createDemoBattleState(state.party.members);
				state.battle.phase = "awaiting-command";
				state.battle.activeActorId = "ghost";
			},
		],
		[
			"victory with a surviving enemy",
			(state) => {
				state.mode = "battle";
				state.battle = createDemoBattleState(state.party.members);
				state.battle.phase = "victory";
			},
		],
	])("rejects current saves with %s", (_label, mutate) => {
		const state = currentState();
		mutate(state);
		expect(decodeGameSave(JSON.stringify(envelope(state)))).toMatchObject({
			status: "corrupt",
			message: "Save data does not match the current schema.",
		});
	});

	it("migrates legacy format v0 only from known coordinates", () => {
		const current = currentState();
		const legacy = {
			formatVersion: 0,
			savedAt,
			state: {
				schemaVersion: 1,
				mode: current.mode,
				currentMap: { id: "signal-ruins", checkpoint: { x: 3, y: 6 } },
				party: toLegacyParty(current),
				story: current.story,
				battle: toLegacyBattle(current),
			},
		};
		const result = decodeGameSave(JSON.stringify(legacy));
		expect(result.status).toBe("ready");
		if (result.status !== "ready") return;
		expect(result.migrated).toBe(true);
		expect(result.save.state.field.partyPositions).toEqual([
			{ x: 8, y: 18 },
			{ x: 7, y: 18 },
			{ x: 6, y: 18 },
		]);

		legacy.state.currentMap.checkpoint = { x: 8, y: 5 };
		expect(decodeGameSave(JSON.stringify(legacy))).toMatchObject({
			status: "unsupported",
			stateVersion: 1,
		});
	});

	it("classifies invalid JSON, values, and schema mismatches", () => {
		expect(decodeGameSave("{")).toEqual({
			status: "corrupt",
			message: "Save data is not valid JSON.",
		});
		expect(decodeGameSave("[]")).toEqual({
			status: "corrupt",
			message: "Save data must be an object.",
		});
		expect(decodeGameSave("{}")).toEqual({
			status: "corrupt",
			message: "Save format version is missing.",
		});
		expect(
			decodeGameSave(
				JSON.stringify({
					formatVersion: GAME_SAVE_FORMAT_VERSION,
					slotId: "autosave",
					savedAt,
					state: { schemaVersion: GAME_STATE_SCHEMA_VERSION },
				}),
			),
		).toMatchObject({ status: "corrupt" });
	});

	it("separates unsupported versions and locations from corruption", () => {
		expect(
			decodeGameSave(JSON.stringify({ formatVersion: 99 })),
		).toMatchObject({ status: "unsupported", formatVersion: 99 });
		expect(
			decodeGameSave(
				JSON.stringify(
					envelope({ schemaVersion: 999 }),
				),
			),
		).toMatchObject({ status: "unsupported", stateVersion: 999 });
		const unknownV2Content = createLegacyV2State();
		unknownV2Content.contentVersion = "another-world";
		expect(
			decodeGameSave(JSON.stringify(envelope(unknownV2Content))),
		).toMatchObject({ status: "unsupported", stateVersion: 2 });

		const unsupportedLocation = createLegacyV2State({ x: 8, y: 5 });
		expect(
			decodeGameSave(JSON.stringify(envelope(unsupportedLocation))),
		).toMatchObject({ status: "unsupported", stateVersion: 2 });

		const corruptV2 = { ...createLegacyV2State(), field: null };
		expect(decodeGameSave(JSON.stringify(envelope(corruptV2)))).toMatchObject({
			status: "corrupt",
		});
		expect(
			decodeGameSave(
				JSON.stringify({ formatVersion: 0, savedAt, state: { schemaVersion: 99 } }),
			),
		).toMatchObject({ status: "unsupported", stateVersion: 99 });
		expect(
			decodeGameSave(JSON.stringify({ formatVersion: 0, state: null })),
		).toMatchObject({ status: "corrupt" });
	});

	it("covers malformed migration envelopes, states, and unknown legacy maps", () => {
		expect(
			decodeGameSave(
				JSON.stringify({
					formatVersion: GAME_SAVE_FORMAT_VERSION,
					state: { schemaVersion: 4 },
				}),
			),
		).toMatchObject({ status: "corrupt" });
		expect(
			decodeGameSave(
				JSON.stringify({
					...envelope([]),
				}),
			),
		).toMatchObject({ status: "corrupt" });
		expect(
			decodeGameSave(JSON.stringify(envelope({ schemaVersion: 4 }))),
		).toMatchObject({
			status: "corrupt",
			message: "Version 4 save data is corrupt.",
		});
		expect(
			decodeGameSave(JSON.stringify(envelope({ schemaVersion: 3 }))),
		).toMatchObject({
			status: "corrupt",
			message: "Version 3 save data is corrupt.",
		});
		expect(
			decodeGameSave(JSON.stringify(envelope({ schemaVersion: "future" }))),
		).toMatchObject({ status: "corrupt" });

		const unknownMap = createLegacyV2State();
		unknownMap.currentMap.id = "unknown-map";
		expect(decodeGameSave(JSON.stringify(envelope(unknownMap)))).toMatchObject({
			status: "unsupported",
			stateVersion: 2,
		});
	});

	it("rejects invalid state and save timestamps when encoding", () => {
		expect(() => serializeGameSave(currentState(), "not-a-date")).toThrow();
		const state = currentState();
		state.rng.state = -1;
		expect(() => serializeGameSave(state, savedAt)).toThrow();
	});
});
