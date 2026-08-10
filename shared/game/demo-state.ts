import type {
	BattleCombatant,
	BattleState,
	CharacterState,
	GameState,
} from "./model";
import { createRandomState } from "./deterministic-rng";
import { createInitialFieldState } from "./field-engine";
import {
	DEFAULT_GAME_RNG_SEED,
	GAME_CONTENT_VERSION,
	GAME_STATE_SCHEMA_VERSION,
} from "./model";

const partyMembers: CharacterState[] = [
	{
		id: "mira",
		name: "Mira",
		level: 1,
		hp: 72,
		maxHp: 72,
		attack: 22,
		defense: 12,
		speed: 13,
		ability: { id: "arc-slash", name: "Arc Slash", powerPercent: 150 },
	},
	{
		id: "sol",
		name: "Sol",
		level: 1,
		hp: 58,
		maxHp: 58,
		attack: 19,
		defense: 9,
		speed: 15,
		ability: { id: "spark-shot", name: "Spark Shot", powerPercent: 145 },
	},
	{
		id: "lune",
		name: "Lune",
		level: 1,
		hp: 64,
		maxHp: 64,
		attack: 17,
		defense: 11,
		speed: 11,
		ability: { id: "echo-strike", name: "Echo Strike", powerPercent: 135 },
	},
];

const enemies: CharacterState[] = [
	{
		id: "ash-wisp",
		name: "Ash Wisp",
		level: 1,
		hp: 42,
		maxHp: 42,
		attack: 13,
		defense: 6,
		speed: 10,
		ability: { id: "ember", name: "Ember", powerPercent: 100 },
	},
	{
		id: "brass-hound",
		name: "Brass Hound",
		level: 1,
		hp: 56,
		maxHp: 56,
		attack: 15,
		defense: 8,
		speed: 8,
		ability: { id: "lunge", name: "Lunge", powerPercent: 100 },
	},
];

const toCombatant = (
	character: CharacterState,
	side: BattleCombatant["side"],
): BattleCombatant => ({
	...character,
	ability: { ...character.ability },
	side,
	actionGauge: 0,
	defending: false,
});

export function createDemoBattleState(
	party: CharacterState[] = partyMembers,
): BattleState {
	return {
		id: "signal-ruins-encounter",
		phase: "running",
		elapsedMs: 0,
		activeActorId: null,
		party: party.map((member) => toCombatant(member, "party")),
		enemies: enemies.map((enemy) => toCombatant(enemy, "enemy")),
	};
}

export function createSignalRuinsEncounterState(
	party: CharacterState[] = partyMembers,
): BattleState {
	const battle = createDemoBattleState(party);
	battle.party[0].actionGauge = 760;
	battle.party[1].actionGauge = 520;
	battle.party[2].actionGauge = 260;
	battle.enemies[0].actionGauge = 420;
	battle.enemies[1].actionGauge = 180;
	return battle;
}

export function createInitialGameState(
	options: { rngSeed?: number } = {},
): GameState {
	return {
		schemaVersion: GAME_STATE_SCHEMA_VERSION,
		contentVersion: GAME_CONTENT_VERSION,
		revision: 0,
		rng: createRandomState(options.rngSeed ?? DEFAULT_GAME_RNG_SEED),
		mode: "field",
		field: createInitialFieldState(),
		currentMap: {
			id: "signal-ruins",
			checkpoint: { x: 3, y: 6 },
		},
		party: {
			members: partyMembers.map((member) => ({
				...member,
				ability: { ...member.ability },
			})),
		},
		story: {
			chapter: "echoes-at-dawn",
			scene: "signal-ruins-arrival",
			flags: {},
			relationships: {
				"mira:sol": 0,
				"mira:lune": 0,
				"sol:lune": 0,
			},
		},
		battle: null,
	};
}
