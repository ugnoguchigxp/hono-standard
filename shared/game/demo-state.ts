import type {
	BattleCombatant,
	BattleState,
	CharacterState,
	GameState,
} from "./model";
import type { GameContentRegistry } from "./content";
import { createRandomState } from "./deterministic-rng";
import type { EncounterProvider } from "./game-session";
import { createFieldStateAt } from "./field-engine";
import { DEFAULT_GAME_RNG_SEED, GAME_STATE_SCHEMA_VERSION } from "./model";

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

const roamingEnemies: CharacterState[] = [
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

const signalWarden: CharacterState = {
	id: "signal-warden",
	name: "Signal Warden",
	level: 4,
	hp: 192,
	maxHp: 192,
	attack: 20,
	defense: 12,
	speed: 9,
	ability: { id: "ruin-pulse", name: "Ruin Pulse", powerPercent: 100 },
};

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
		enemies: roamingEnemies.map((enemy) => toCombatant(enemy, "enemy")),
	};
}

export function createSignalRuinsEncounterState(
	party: CharacterState[] = partyMembers,
): BattleState {
	const battle: BattleState = {
		id: "signal-ruins-encounter",
		phase: "running",
		elapsedMs: 0,
		activeActorId: null,
		party: party.map((member) => toCombatant(member, "party")),
		enemies: [toCombatant(signalWarden, "enemy")],
	};
	battle.party[0].actionGauge = 760;
	battle.party[1].actionGauge = 520;
	battle.party[2].actionGauge = 260;
	battle.enemies[0].actionGauge = 360;
	return battle;
}

export function createSignalRuinsRoamersState(
	party: CharacterState[] = partyMembers,
): BattleState {
	return {
		id: "signal-ruins-roamers",
		phase: "running",
		elapsedMs: 0,
		activeActorId: null,
		party: party.map((member) => toCombatant(member, "party")),
		enemies: [toCombatant(roamingEnemies[0], "enemy")],
	};
}

export const createDemoEncounterProvider =
	(): EncounterProvider => (encounterId, party) => {
		if (encounterId === "signal-ruins-encounter") {
			return createSignalRuinsEncounterState([...party]);
		}
		if (encounterId === "signal-ruins-roamers") {
			return createSignalRuinsRoamersState([...party]);
		}
		throw new Error(`Unknown demo encounter '${encounterId}'.`);
	};

export function createInitialGameState(options: {
	registry: GameContentRegistry;
	rngSeed?: number;
}): GameState {
	const map = options.registry.getMap(options.registry.entryPoint.mapId);
	const entrance = map.entrances.find(
		(candidate) => candidate.id === options.registry.entryPoint.entranceId,
	);
	if (!entrance) {
		throw new Error(
			`Missing entry entrance '${map.id}:${options.registry.entryPoint.entranceId}'.`,
		);
	}
	return {
		schemaVersion: GAME_STATE_SCHEMA_VERSION,
		contentVersion: options.registry.contentVersion,
		revision: 0,
		rng: createRandomState(options.rngSeed ?? DEFAULT_GAME_RNG_SEED),
		mode: "field",
		location: {
			mapId: map.id,
			entranceId: entrance.id,
			checkpointId: entrance.checkpointId,
		},
		field: createFieldStateAt(entrance.position, entrance.facing),
		event: null,
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
