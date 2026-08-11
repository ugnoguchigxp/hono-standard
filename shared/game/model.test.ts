import { describe, expect, it } from "vitest";
import { validateGameContentDirectory } from "../../scripts/validate-game-content";
import { createBattleStateFromEncounter, createInitialGameState } from "./demo-state";
import { advanceEvent } from "./event-engine";
import {
	ACTION_GAUGE_MAX,
	type GameState,
	getGameStateInvariantIssues,
} from "./model";

const registry = validateGameContentDirectory();

const createBattleGame = (): GameState => {
	const state = createInitialGameState({ registry });
	state.mode = "battle";
	state.battle = createBattleStateFromEncounter(
		registry,
		"signal-ruins-roamers",
		state.party.members,
		state.party.inventory,
	);
	return state;
};

const createEventGame = (): GameState => {
	const state = createInitialGameState({ registry });
	state.mode = "event";
	state.event = advanceEvent(
		registry.getEvent("signal-ruins-contact"),
		null,
		state.story,
		{ type: "start" },
	).event;
	return state;
};

describe("game state invariants", () => {
	it("accepts coherent field, event, and battle snapshots", () => {
		expect(getGameStateInvariantIssues(createInitialGameState({ registry }))).toEqual(
			[],
		);
		expect(getGameStateInvariantIssues(createEventGame())).toEqual([]);
		expect(getGameStateInvariantIssues(createBattleGame())).toEqual([]);
	});

	it("reports malformed numeric, identity, inventory, event, and battle data together", () => {
		const state = createBattleGame();
		state.revision = -1;
		state.rng.state = -1;
		state.story.relationships["mira:sol"] = Number.NaN;
		state.field.stepsSinceEncounter = -1;
		state.field.partyPositions[1] = { ...state.field.partyPositions[0] };
		state.party.inventory.potion = -1;
		state.party.equipmentInventory["swift-band"] = Number.NaN;
		state.party.equipment.ghost = {
			weapon: null,
			armor: null,
			"off-hand": null,
			relic: null,
		};

		const member = state.party.members[0];
		member.level = 0;
		member.experience = -1;
		member.maxHp = 0;
		member.hp = 2;
		member.maxMp = -1;
		member.mp = 2;
		member.attack = 0;
		member.defense = -1;
		member.speed = Number.NaN;
		member.abilities.push({ ...member.abilities[0] });
		member.abilities[0].powerPercent = -1;
		member.abilities[0].mpCost = -1;
		member.ability = { ...member.ability, id: "missing" };
		state.party.members.push(structuredClone(state.party.members[1]));

		const event = createEventGame().event;
		if (!event) throw new Error("Missing event fixture.");
		event.actors.push({ ...event.actors[0] });
		event.status = "running";
		event.visibleLine = { speakerId: "mira", text: "pending" };
		state.event = event;

		const battle = state.battle;
		if (!battle) throw new Error("Missing battle fixture.");
		battle.elapsedMs = -1;
		battle.activeActorId = "mira";
		battle.party[0].actionGauge = ACTION_GAUGE_MAX + 1;
		battle.party[0].turnsTaken = -1;
		battle.party[0].statuses = [
			{
				id: "expired",
				name: "Expired",
				description: "Expired status",
				polarity: "negative",
				durationTurns: 1,
				turnsRemaining: 0,
				attackPercent: 0,
				defensePercent: 0,
				speedPercent: 0,
				damagePercentMaxHp: 0,
			},
		];
		battle.party[0].statuses.push({ ...battle.party[0].statuses[0] });
		battle.enemies[0].id = "mira";
		battle.enemies[0].side = "party";
		battle.items.push({ ...battle.items[0] });
		battle.items[0].count = -1;
		battle.party[0].attack += 1;
		for (const enemy of battle.enemies) enemy.hp = 0;

		const messages = getGameStateInvariantIssues(state).map(
			({ message }) => message,
		);
		expect(messages).toEqual(
			expect.arrayContaining([
				"State revision must be a non-negative safe integer.",
				"Story relationships must remain between -100 and 100.",
				"Field encounter steps must be a non-negative safe integer.",
				"Running battles cannot retain an active command actor.",
				"Running battles require living combatants on both sides.",
			]),
		);
		expect(messages.length).toBeGreaterThan(20);
	});

	it("enforces event presentation states and mode ownership", () => {
		const field = createInitialGameState({ registry });
		field.event = createEventGame().event;
		expect(getGameStateInvariantIssues(field)[0].message).toContain("Field mode");

		const missingEvent = createInitialGameState({ registry });
		missingEvent.mode = "event";
		expect(getGameStateInvariantIssues(missingEvent)[0].message).toContain(
			"Event mode",
		);

		const missingBattle = createInitialGameState({ registry });
		missingBattle.mode = "battle";
		expect(getGameStateInvariantIssues(missingBattle)[0].message).toContain(
			"Battle mode",
		);

		const eventState = createEventGame();
		if (!eventState.event) throw new Error("Missing event fixture.");
		eventState.event.visibleLine = null;
		eventState.event.choices = [{ id: "bad", text: "Bad" }];
		let messages = getGameStateInvariantIssues(eventState).map(
			({ message }) => message,
		);
		expect(messages.some((message) => message.includes("visible line"))).toBe(true);
		expect(messages.some((message) => message.includes("cannot contain choices"))).toBe(
			true,
		);

		eventState.event.status = "awaiting-choice";
		eventState.event.choices = [];
		messages = getGameStateInvariantIssues(eventState).map(({ message }) => message);
		expect(messages.some((message) => message.includes("requires a prompt"))).toBe(
			true,
		);
		eventState.event.status = "running";
		expect(
			getGameStateInvariantIssues(eventState).some(({ message }) =>
				message.includes("only valid while its battle"),
			),
		).toBe(true);
	});

	it("validates awaiting-command and every completed battle phase", () => {
		const awaiting = createBattleGame();
		if (!awaiting.battle) throw new Error("Missing battle fixture.");
		awaiting.battle.phase = "awaiting-command";
		awaiting.battle.activeActorId = "missing";
		expect(
			getGameStateInvariantIssues(awaiting).some(({ message }) =>
				message.includes("living, ready party actor"),
			),
		).toBe(true);

		const victory = createBattleGame();
		if (!victory.battle) throw new Error("Missing battle fixture.");
		victory.battle.phase = "victory";
		victory.battle.activeActorId = "mira";
		let messages = getGameStateInvariantIssues(victory).map(
			({ message }) => message,
		);
		expect(messages.some((message) => message.includes("Completed battles"))).toBe(
			true,
		);
		expect(messages.some((message) => message.includes("Victory requires"))).toBe(
			true,
		);

		const defeat = createBattleGame();
		if (!defeat.battle) throw new Error("Missing battle fixture.");
		defeat.battle.phase = "defeat";
		messages = getGameStateInvariantIssues(defeat).map(({ message }) => message);
		expect(messages.some((message) => message.includes("Defeat requires"))).toBe(
			true,
		);

		const suspended = createBattleGame();
		suspended.event = createEventGame().event;
		if (!suspended.event) throw new Error("Missing event fixture.");
		suspended.event.status = "awaiting-confirm";
		expect(
			getGameStateInvariantIssues(suspended).some(({ message }) =>
				message.includes("suspended by battle"),
			),
		).toBe(true);
	});
});
