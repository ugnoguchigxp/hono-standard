import { describe, expect, it } from "vitest";
import { validateGameContentDirectory } from "../../scripts/validate-game-content";
import {
	advanceBattle,
	applyBattleCommand,
	BattleRuleError,
} from "./battle-engine";
import {
	createDemoBattleState,
	createDemoEncounterProvider,
	createInitialGameState,
	createSignalRuinsEncounterState,
	createSignalRuinsRoamersState,
} from "./demo-state";
import {
	ACTION_GAUGE_MAX,
	GAME_CONTENT_VERSION,
	GAME_STATE_SCHEMA_VERSION,
} from "./model";

const registry = validateGameContentDirectory();

const readyPartyMember = () => {
	const state = createDemoBattleState();
	state.party[0].actionGauge = ACTION_GAUGE_MAX;
	state.phase = "awaiting-command";
	state.activeActorId = state.party[0].id;
	return state;
};

describe("battle engine", () => {
	it("rejects unknown demo encounter IDs", () => {
		expect(() => createDemoEncounterProvider()("missing", [])).toThrow(
			"Unknown demo encounter",
		);
	});
	it("creates an isolated serializable initial game state", () => {
		const first = createInitialGameState({ registry });
		const second = createInitialGameState({ registry });
		first.party.members[0].hp = 1;

		expect(second.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
		expect(second.contentVersion).toBe(GAME_CONTENT_VERSION);
		expect(second.revision).toBe(0);
		expect(second.mode).toBe("field");
		expect(second.party.members).toHaveLength(3);
		expect(second.party.members[0].hp).toBe(72);
		expect(JSON.parse(JSON.stringify(second))).toEqual(second);
	});

	it("stages the Signal Ruins encounter with the persistent party", () => {
		const game = createInitialGameState({ registry });
		game.party.members[0].hp = 33;
		const battle = createSignalRuinsEncounterState(game.party.members);
		expect(battle.party[0]).toMatchObject({ hp: 33, actionGauge: 760 });
		expect(battle.party[1].actionGauge).toBe(520);
		expect(battle.enemies).toHaveLength(1);
		expect(battle.enemies[0]).toMatchObject({
			id: "signal-warden",
			hp: 192,
			maxHp: 192,
			actionGauge: 360,
		});
	});

	it("stages a smaller roaming encounter independently of the boss", () => {
		const battle = createSignalRuinsRoamersState();
		expect(battle.id).toBe("signal-ruins-roamers");
		expect(battle.enemies).toHaveLength(1);
		expect(battle.enemies[0]).toMatchObject({ id: "ash-wisp", hp: 42 });
	});

	it("advances gauges without mutating the input state", () => {
		const state = createDemoBattleState();
		const transition = advanceBattle(state, 1_000);

		expect(state.elapsedMs).toBe(0);
		expect(state.party[0].actionGauge).toBe(0);
		expect(transition.state.elapsedMs).toBe(1_000);
		expect(transition.state.party[0].actionGauge).toBeGreaterThan(0);
		expect(transition.events).toEqual([]);
	});

	it("stops the wait-mode timeline when a party member is ready", () => {
		const state = createDemoBattleState();
		const transition = advanceBattle(state, 10_000);

		expect(transition.state.phase).toBe("awaiting-command");
		expect(transition.state.activeActorId).toBe("sol");
		expect(transition.events).toContainEqual({
			type: "gauge.ready",
			actorId: "sol",
		});
		expect(advanceBattle(transition.state, 1_000)).toEqual({
			state: transition.state,
			events: [],
		});
	});

	it("breaks equal-speed ready ties by stable combatant ID", () => {
		const state = createDemoBattleState();
		state.party[0].speed = 10;
		state.party[1].speed = 10;
		state.party[0].actionGauge = ACTION_GAUGE_MAX - 1;
		state.party[1].actionGauge = ACTION_GAUGE_MAX - 1;
		const transition = advanceBattle(state, 100);
		expect(transition.events[0]).toEqual({
			type: "gauge.ready",
			actorId: "mira",
		});
	});

	it("lets a ready actor attack without mutating the command source", () => {
		const state = readyPartyMember();
		const targetHp = state.enemies[0].hp;
		const transition = applyBattleCommand(state, {
			type: "attack",
			actorId: "mira",
			targetId: "ash-wisp",
		});

		expect(state.enemies[0].hp).toBe(targetHp);
		expect(transition.state.enemies[0].hp).toBeLessThan(targetHp);
		expect(transition.state.party[0].actionGauge).toBe(0);
		expect(transition.state.phase).toBe("running");
		expect(transition.events[0]).toMatchObject({
			type: "action.damage",
			actorId: "mira",
			targetId: "ash-wisp",
		});
	});

	it("applies the actor's unique ability and can finish a battle", () => {
		const state = readyPartyMember();
		state.enemies[0].hp = 1;
		state.enemies[1].hp = 0;
		const transition = applyBattleCommand(state, {
			type: "ability",
			actorId: "mira",
			targetId: "ash-wisp",
			abilityId: "arc-slash",
		});

		expect(transition.state.phase).toBe("victory");
		expect(transition.events).toContainEqual({
			type: "combatant.defeated",
			combatantId: "ash-wisp",
		});
		expect(transition.events).toContainEqual({
			type: "battle.ended",
			result: "victory",
		});
		expect(transition.events[0]).toMatchObject({
			type: "action.damage",
			abilityId: "arc-slash",
		});
	});

	it("defends and halves the next incoming hit", () => {
		const state = readyPartyMember();
		state.party[0].hp = 60;
		const defended = applyBattleCommand(state, {
			type: "defend",
			actorId: "mira",
		});
		expect(defended.state.party[0].defending).toBe(true);
		expect(defended.events).toEqual([
			{ type: "action.defend", actorId: "mira" },
		]);

		defended.state.enemies[0].actionGauge = ACTION_GAUGE_MAX;
		const beforeHp = defended.state.party[0].hp;
		const attacked = advanceBattle(defended.state, 1);
		const damageEvent = attacked.events.find(
			(event) => event.type === "action.damage",
		);

		expect(damageEvent).toMatchObject({ targetId: "mira", amount: 4 });
		expect(attacked.state.party[0].hp).toBe(beforeHp - 4);
		expect(attacked.state.party[0].defending).toBe(false);
	});

	it("executes deterministic enemy actions and detects defeat", () => {
		const state = createDemoBattleState();
		for (const member of state.party) member.hp = 0;
		state.party[0].hp = 1;
		state.enemies[0].actionGauge = ACTION_GAUGE_MAX;

		const transition = advanceBattle(state, 1);

		expect(transition.state.phase).toBe("defeat");
		expect(transition.events).toContainEqual({
			type: "battle.ended",
			result: "defeat",
		});
	});

	it("ignores invalid time deltas", () => {
		const state = createDemoBattleState();
		expect(advanceBattle(state, 0)).toEqual({ state, events: [] });
		expect(advanceBattle(state, Number.NaN)).toEqual({ state, events: [] });
	});

	it("rejects commands that violate battle rules", () => {
		const running = createDemoBattleState();
		expect(() =>
			applyBattleCommand(running, {
				type: "defend",
				actorId: "mira",
			}),
		).toThrow(BattleRuleError);

		const ready = readyPartyMember();
		expect(() =>
			applyBattleCommand(ready, {
				type: "attack",
				actorId: "mira",
				targetId: "missing",
			}),
		).toThrow("selected enemy target");
		expect(() =>
			applyBattleCommand(ready, {
				type: "ability",
				actorId: "mira",
				targetId: "ash-wisp",
				abilityId: "unknown",
			}),
		).toThrow("cannot use");

		const missingActor = readyPartyMember();
		missingActor.activeActorId = "missing";
		expect(() =>
			applyBattleCommand(missingActor, {
				type: "defend",
				actorId: "missing",
			}),
		).toThrow("acting party member");
	});
});
