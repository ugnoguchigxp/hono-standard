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
		party: current.party,
		story: current.story,
		battle: current.battle,
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

	it("loads earlier v4 saves with a zeroed encounter step counter", () => {
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
				party: current.party,
				story: current.story,
				battle: current.battle,
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

	it("rejects invalid state and save timestamps when encoding", () => {
		expect(() => serializeGameSave(currentState(), "not-a-date")).toThrow();
		const state = currentState();
		state.rng.state = -1;
		expect(() => serializeGameSave(state, savedAt)).toThrow();
	});
});
