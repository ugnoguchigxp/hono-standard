import { describe, expect, it } from "vitest";
import { validateGameContentDirectory } from "../../scripts/validate-game-content";
import {
	advanceBattle,
	applyBattleCommand,
	BattleRuleError,
	simulateBattle,
} from "./battle-engine";
import {
	createBattleStateFromEncounter,
	createDemoBattleState,
	createDemoEncounterProvider,
	createInitialGameState,
	createSignalRuinsEncounterState,
	createSignalRuinsRoamersState,
} from "./demo-state";
import type {
	AbilityDefinition,
	BattleState,
	BattleStatusState,
} from "./model";
import {
	createInitialPartyState,
	grantExperience,
	toRuntimeAbility,
} from "./progression-engine";
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

const setReadyActor = (state: BattleState, actorId: string): BattleState => {
	for (const member of state.party) {
		member.actionGauge = member.id === actorId ? ACTION_GAUGE_MAX : 0;
	}
	state.phase = "awaiting-command";
	state.activeActorId = actorId;
	return state;
};

const blight = (turnsRemaining = 3): BattleStatusState => ({
	id: "ruin-blight",
	name: "Ruin Blight",
	description: "Damage over time",
	polarity: "negative",
	durationTurns: 3,
	turnsRemaining,
	attackPercent: 0,
	defensePercent: 0,
	speedPercent: 0,
	damagePercentMaxHp: 7,
});

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

	it("executes at most one ready enemy action per timeline advance", () => {
		const state = createDemoBattleState();
		state.enemies[0].actionGauge = ACTION_GAUGE_MAX;
		state.enemies[1].actionGauge = ACTION_GAUGE_MAX;

		const transition = advanceBattle(state, 1);
		const damageEvents = transition.events.filter(
			(event) => event.type === "action.damage",
		);

		expect(damageEvents).toHaveLength(1);
		expect(damageEvents[0]).toMatchObject({ actorId: "ash-wisp" });
		expect(transition.state.enemies[0].actionGauge).toBe(0);
		expect(transition.state.enemies[1].actionGauge).toBe(ACTION_GAUGE_MAX);
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

	it("creates a content-driven multi-enemy encounter with battle inventory", () => {
		const game = createInitialGameState({ registry });
		const battle = createBattleStateFromEncounter(
			registry,
			"signal-ruins-roamers",
			game.party.members,
			game.party.inventory,
		);

		expect(battle.enemies.map(({ id }) => id)).toEqual([
			"ash-wisp",
			"brass-hound",
		]);
		expect(battle.items.find(({ id }) => id === "potion")?.count).toBe(5);
		expect(battle.canEscape).toBe(true);
	});

	it("spends MP and reports elemental weakness damage", () => {
		const game = createInitialGameState({ registry });
		const battle = createBattleStateFromEncounter(
			registry,
			"signal-ruins-roamers",
			game.party.members,
			game.party.inventory,
		);
		const sol = battle.party.find(({ id }) => id === "sol");
		if (!sol) throw new Error("Expected Sol.");
		battle.phase = "awaiting-command";
		battle.activeActorId = sol.id;
		const transition = applyBattleCommand(battle, {
			type: "ability",
			actorId: sol.id,
			targetId: "ash-wisp",
			abilityId: "spark-shot",
		});

		expect(transition.state.party.find(({ id }) => id === "sol")?.mp).toBe(9);
		expect(transition.events).toContainEqual({
			type: "resource.spent",
			actorId: "sol",
			amount: 5,
			resource: "mp",
		});
		expect(transition.events).toContainEqual(
			expect.objectContaining({
				type: "action.damage",
				element: "lightning",
				multiplier: 1.5,
			}),
		);
	});

	it("heals a chosen ally and applies an all-party status through targeting rules", () => {
		const game = createInitialGameState({ registry });
		const luneIndex = game.party.members.findIndex(({ id }) => id === "lune");
		const leveledLune = grantExperience(
			game.party.members[luneIndex],
			100,
			game.party.equipment.lune,
			registry,
		).member;
		game.party.members[luneIndex] = leveledLune;
		game.party.members[0].hp = 20;
		const battle = createBattleStateFromEncounter(
			registry,
			"signal-ruins-encounter",
			game.party.members,
			game.party.inventory,
		);
		battle.phase = "awaiting-command";
		battle.activeActorId = "lune";
		const healed = applyBattleCommand(battle, {
			type: "ability",
			actorId: "lune",
			targetId: "mira",
			abilityId: "mend",
		});
		expect(healed.events).toContainEqual(
			expect.objectContaining({
				type: "action.heal",
				targetId: "mira",
				abilityId: "mend",
			}),
		);

		let enemyTurn = healed.state;
		const warden = enemyTurn.enemies[0];
		warden.turnsTaken = 1;
		warden.actionGauge = ACTION_GAUGE_MAX;
		enemyTurn.phase = "running";
		const slowed = advanceBattle(enemyTurn, 1);
		expect(
			slowed.events.filter(({ type }) => type === "status.applied"),
		).toHaveLength(3);
		expect(
			slowed.state.party.every(({ statuses }) =>
				statuses.some(({ id }) => id === "signal-slow"),
			),
		).toBe(true);
	});

	it("uses battle items and allows escape only when the encounter permits it", () => {
		const game = createInitialGameState({ registry });
		const battle = createBattleStateFromEncounter(
			registry,
			"signal-ruins-roamers",
			game.party.members,
			game.party.inventory,
		);
		battle.party[0].hp = 10;
		battle.phase = "awaiting-command";
		battle.activeActorId = "mira";
		const used = applyBattleCommand(battle, {
			type: "item",
			actorId: "mira",
			targetId: "mira",
			itemId: "potion",
		});
		expect(used.state.party[0].hp).toBe(60);
		expect(used.state.items.find(({ id }) => id === "potion")?.count).toBe(4);

		used.state.phase = "awaiting-command";
		used.state.activeActorId = "mira";
		const escaped = applyBattleCommand(used.state, {
			type: "escape",
			actorId: "mira",
		});
		expect(escaped.state.phase).toBe("escaped");
		expect(escaped.events).toEqual([
			{ type: "battle.ended", result: "escaped" },
		]);
	});

	it("rejects blocked escapes, insufficient MP, and unavailable ability targets", () => {
		const blocked = readyPartyMember();
		expect(() =>
			applyBattleCommand(blocked, { type: "escape", actorId: "mira" }),
		).toThrow("cannot be escaped");

		const party = createInitialPartyState(registry);
		const state = createBattleStateFromEncounter(
			registry,
			"signal-ruins-roamers",
			party.members,
		);
		const lune = state.party.find(({ id }) => id === "lune");
		if (!lune) throw new Error("Missing Lune fixture.");
		lune.abilities.push(toRuntimeAbility(registry.getAbility("mend"), registry));
		lune.mp = 0;
		setReadyActor(state, "lune");
		expect(() =>
			applyBattleCommand(state, {
				type: "ability",
				actorId: "lune",
				targetId: "mira",
				abilityId: "mend",
			}),
		).toThrow("enough MP");
		lune.mp = lune.maxMp;
		expect(() =>
			applyBattleCommand(state, {
				type: "ability",
				actorId: "lune",
				targetId: "missing",
				abilityId: "mend",
			}),
		).toThrow("selected target");
	});

	it("handles empty heals plus self-targeted, replaced, and resisted statuses", () => {
		const party = createInitialPartyState(registry);
		const state = createBattleStateFromEncounter(
			registry,
			"signal-ruins-roamers",
			party.members,
		);
		const mira = state.party[0];
		const rally = toRuntimeAbility(
			registry.getAbility("rallying-light"),
			registry,
		);
		const noChance: AbilityDefinition = {
			...rally,
			id: "no-chance",
			target: "self",
			statusChance: 0,
		};
		mira.abilities.push(noChance);
		setReadyActor(state, "mira");
		const resisted = applyBattleCommand(state, {
			type: "ability",
			actorId: "mira",
			targetId: "ignored",
			abilityId: "no-chance",
		});
		expect(
			resisted.events.some(({ type }) => type === "status.applied"),
		).toBe(false);

		const selfState = structuredClone(state);
		const selfRally: AbilityDefinition = {
			...rally,
			id: "self-rally",
			target: "self",
		};
		selfState.party[0].abilities.push(selfRally);
		selfState.party[0].statuses.push({
			...rally.statusEffect!,
			turnsRemaining: 1,
		});
		setReadyActor(selfState, "mira");
		const replaced = applyBattleCommand(selfState, {
			type: "ability",
			actorId: "mira",
			targetId: "ignored",
			abilityId: "self-rally",
		});
		expect(replaced.events).toContainEqual({
			type: "status.applied",
			actorId: "mira",
			targetId: "mira",
			statusId: "valor",
		});

		const healState = structuredClone(state);
		const selfHeal: AbilityDefinition = {
			...toRuntimeAbility(registry.getAbility("mend"), registry),
			id: "self-heal",
			target: "self",
		};
		healState.party[0].abilities.push(selfHeal);
		setReadyActor(healState, "mira");
		const fullHeal = applyBattleCommand(healState, {
			type: "ability",
			actorId: "mira",
			targetId: "ignored",
			abilityId: "self-heal",
		});
		expect(fullHeal.events.some(({ type }) => type === "action.heal")).toBe(
			false,
		);
	});

	it("ticks, expires, and defeats actors through end-of-turn statuses", () => {
		const surviving = readyPartyMember();
		surviving.party[0].statuses = [blight(2)];
		surviving.party[0].hp = 20;
		const ticked = applyBattleCommand(surviving, {
			type: "defend",
			actorId: "mira",
		});
		expect(ticked.events).toContainEqual({
			type: "status.damage",
			combatantId: "mira",
			statusId: "ruin-blight",
			amount: 5,
		});
		expect(ticked.state.party[0].statuses[0].turnsRemaining).toBe(1);

		const defeated = readyPartyMember();
		for (const member of defeated.party) member.hp = 0;
		defeated.party[0].hp = 1;
		defeated.party[0].statuses = [blight(1)];
		const expired = applyBattleCommand(defeated, {
			type: "defend",
			actorId: "mira",
		});
		expect(expired.events).toContainEqual({
			type: "combatant.defeated",
			combatantId: "mira",
		});
		expect(expired.events).toContainEqual({
			type: "status.expired",
			combatantId: "mira",
			statusId: "ruin-blight",
		});
		expect(expired.state.phase).toBe("defeat");
	});

	it("uses every battle-item effect and rejects unavailable or ineffective items", () => {
		const initialParty = createInitialPartyState(registry);
		const makeState = () =>
			setReadyActor(
				createBattleStateFromEncounter(
					registry,
					"signal-ruins-roamers",
					initialParty.members,
					initialParty.inventory,
				),
				"mira",
			);
		const use = (state: BattleState, itemId: string, targetId = "mira") =>
			applyBattleCommand(state, {
				type: "item",
				actorId: "mira",
				targetId,
				itemId,
			});

		const mp = makeState();
		mp.party[0].mp = 0;
		expect(use(mp, "ether").events[0]).toMatchObject({
			effect: "restore-mp",
			amount: mp.party[0].maxMp,
		});
		const revive = makeState();
		revive.party[1].hp = 0;
		expect(use(revive, "phoenix-feather", "sol").events[0]).toMatchObject({
			effect: "revive",
		});
		const cure = makeState();
		cure.party[0].statuses = [blight()];
		expect(use(cure, "antidote").events[0]).toMatchObject({
			effect: "cure-status",
			amount: 1,
		});

		expect(() => use(makeState(), "missing")).toThrow("unavailable");
		const empty = makeState();
		const potion = empty.items.find(({ id }) => id === "potion");
		if (!potion) throw new Error("Missing potion fixture.");
		potion.count = 0;
		expect(() => use(empty, "potion")).toThrow("unavailable");
		expect(() => use(makeState(), "potion", "missing")).toThrow(
			"target is unavailable",
		);
		expect(() => use(makeState(), "potion")).toThrow("has no effect");
	});

	it("falls back to basic enemy attacks and reports simulation stalls", () => {
		const fallback = createDemoBattleState();
		fallback.enemies[0].aiPattern = ["missing"];
		fallback.enemies[0].actionGauge = ACTION_GAUGE_MAX;
		expect(advanceBattle(fallback, 1).events[0]).toMatchObject({
			type: "action.damage",
			actorId: "ash-wisp",
		});

		const zeroTicks = simulateBattle(createDemoBattleState(), 0);
		expect(zeroTicks).toMatchObject({ commands: 0, ticks: 0, stalled: true });
		const missingActor = createDemoBattleState();
		missingActor.phase = "awaiting-command";
		missingActor.activeActorId = "missing";
		expect(simulateBattle(missingActor, 1).stalled).toBe(true);
		const missingTarget = readyPartyMember();
		for (const enemy of missingTarget.enemies) enemy.hp = 0;
		expect(simulateBattle(missingTarget, 1).stalled).toBe(true);
	});

	it.each(["signal-ruins-roamers", "signal-ruins-encounter"])(
		"finishes deterministic balance simulation for %s without stalling",
		(encounterId) => {
			const game = createInitialGameState({ registry });
			const result = simulateBattle(
				createBattleStateFromEncounter(
					registry,
					encounterId,
					game.party.members,
					game.party.inventory,
				),
			);
			expect(result.stalled).toBe(false);
			expect(result.state.phase).toBe("victory");
			expect(result.commands).toBeGreaterThan(0);
		},
	);
});
