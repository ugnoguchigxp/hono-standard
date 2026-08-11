import type { GameContentRegistry } from "./content";
import { createRandomState } from "./deterministic-rng";
import { createFieldStateAt } from "./field-engine";
import type { EncounterProvider } from "./game-session";
import type {
	BattleCombatant,
	BattleItemStack,
	BattleState,
	CharacterState,
	GameState,
	InventoryState,
} from "./model";
import { DEFAULT_GAME_RNG_SEED, GAME_STATE_SCHEMA_VERSION } from "./model";
import {
	createInitialPartyState,
	toRuntimeAbility,
} from "./progression-engine";

const legacyAbility = (id: string, name: string, powerPercent: number) => ({
	id,
	name,
	description: name,
	kind: "damage" as const,
	target: "enemy-single" as const,
	powerPercent,
	mpCost: 0,
	element: "physical" as const,
});

const legacyCharacter = (options: {
	id: string;
	name: string;
	level: number;
	hp: number;
	attack: number;
	defense: number;
	speed: number;
	ability: ReturnType<typeof legacyAbility>;
}): CharacterState => ({
	...options,
	experience: 0,
	maxHp: options.hp,
	mp: 0,
	maxMp: 0,
	ability: options.ability,
	abilities: [options.ability],
});

const legacyPartyMembers: CharacterState[] = [
	legacyCharacter({
		id: "mira",
		name: "Mira",
		level: 1,
		hp: 72,
		attack: 22,
		defense: 12,
		speed: 13,
		ability: legacyAbility("arc-slash", "Arc Slash", 150),
	}),
	legacyCharacter({
		id: "sol",
		name: "Sol",
		level: 1,
		hp: 58,
		attack: 19,
		defense: 9,
		speed: 15,
		ability: legacyAbility("spark-shot", "Spark Shot", 145),
	}),
	legacyCharacter({
		id: "lune",
		name: "Lune",
		level: 1,
		hp: 64,
		attack: 17,
		defense: 11,
		speed: 11,
		ability: legacyAbility("echo-strike", "Echo Strike", 135),
	}),
];

const legacyEnemies: CharacterState[] = [
	legacyCharacter({
		id: "ash-wisp",
		name: "Ash Wisp",
		level: 1,
		hp: 42,
		attack: 13,
		defense: 6,
		speed: 10,
		ability: legacyAbility("ember", "Ember", 100),
	}),
	legacyCharacter({
		id: "brass-hound",
		name: "Brass Hound",
		level: 1,
		hp: 56,
		attack: 15,
		defense: 8,
		speed: 8,
		ability: legacyAbility("lunge", "Lunge", 100),
	}),
];

const legacyWarden = legacyCharacter({
	id: "signal-warden",
	name: "Signal Warden",
	level: 4,
	hp: 192,
	attack: 20,
	defense: 12,
	speed: 9,
	ability: legacyAbility("ruin-pulse", "Ruin Pulse", 100),
});

const toCombatant = (
	character: CharacterState,
	side: BattleCombatant["side"],
	options: {
		elementMultipliers?: BattleCombatant["elementMultipliers"];
		aiPattern?: string[];
	} = {},
): BattleCombatant => ({
	...character,
	ability: { ...character.ability },
	abilities: character.abilities.map((ability) => ({ ...ability })),
	side,
	actionGauge: 0,
	defending: false,
	statuses: [],
	elementMultipliers: { ...options.elementMultipliers },
	aiPattern: [...(options.aiPattern ?? [])],
	turnsTaken: 0,
});

const battleItemsFromInventory = (
	registry: GameContentRegistry,
	inventory: InventoryState,
): BattleItemStack[] =>
	Object.entries(inventory).flatMap(([itemId, count]) => {
		const item = registry.itemsById[itemId];
		if (item?.kind !== "consumable" || count <= 0) return [];
		return [
			{
				id: item.id,
				name: item.displayName,
				description: item.description,
				effect: item.effect,
				power: item.power,
				statusIds: [...item.statusIds],
				target: item.target,
				count,
			},
		];
	});

export function createBattleStateFromEncounter(
	registry: GameContentRegistry,
	encounterId: string,
	party: readonly CharacterState[],
	inventory: InventoryState = {},
): BattleState {
	const encounter = registry.getEncounter(encounterId);
	const enemies = encounter.enemyIds.map((enemyId) => {
		const definition = registry.getEnemy(enemyId);
		const abilities = definition.abilityIds.map((abilityId) =>
			toRuntimeAbility(registry.getAbility(abilityId), registry),
		);
		if (!abilities[0]) throw new Error(`Enemy '${enemyId}' has no ability.`);
		return toCombatant(
			{
				id: definition.id,
				name: definition.displayName,
				level: definition.level,
				experience: 0,
				hp: definition.stats.maxHp,
				maxHp: definition.stats.maxHp,
				mp: definition.stats.maxMp,
				maxMp: definition.stats.maxMp,
				attack: definition.stats.attack,
				defense: definition.stats.defense,
				speed: definition.stats.speed,
				ability: abilities[0],
				abilities,
			},
			"enemy",
			{
				elementMultipliers: definition.elementMultipliers,
				aiPattern: definition.aiPattern,
			},
		);
	});
	const battle: BattleState = {
		id: encounter.id,
		phase: "running",
		elapsedMs: 0,
		activeActorId: null,
		party: party.map((member) => toCombatant(member, "party")),
		enemies,
		items: battleItemsFromInventory(registry, inventory),
		canEscape: encounter.canEscape,
	};
	if (encounter.boss) {
		battle.party.forEach((member, index) => {
			member.actionGauge = Math.max(0, 760 - index * 240);
		});
		if (battle.enemies[0]) battle.enemies[0].actionGauge = 360;
	}
	return battle;
}

export function createDemoBattleState(
	party: CharacterState[] = legacyPartyMembers,
): BattleState {
	return {
		id: "signal-ruins-encounter",
		phase: "running",
		elapsedMs: 0,
		activeActorId: null,
		party: party.map((member) => toCombatant(member, "party")),
		enemies: legacyEnemies.map((enemy) =>
			toCombatant(enemy, "enemy", { aiPattern: [enemy.ability.id] }),
		),
		items: [],
		canEscape: false,
	};
}

export function createSignalRuinsEncounterState(
	party: CharacterState[] = legacyPartyMembers,
): BattleState {
	const battle: BattleState = {
		id: "signal-ruins-encounter",
		phase: "running",
		elapsedMs: 0,
		activeActorId: null,
		party: party.map((member) => toCombatant(member, "party")),
		enemies: [
			toCombatant(legacyWarden, "enemy", {
				aiPattern: [legacyWarden.ability.id],
			}),
		],
		items: [],
		canEscape: false,
	};
	battle.party[0].actionGauge = 760;
	battle.party[1].actionGauge = 520;
	battle.party[2].actionGauge = 280;
	battle.enemies[0].actionGauge = 360;
	return battle;
}

export function createSignalRuinsRoamersState(
	party: CharacterState[] = legacyPartyMembers,
): BattleState {
	return {
		id: "signal-ruins-roamers",
		phase: "running",
		elapsedMs: 0,
		activeActorId: null,
		party: party.map((member) => toCombatant(member, "party")),
		enemies: [
			toCombatant(legacyEnemies[0], "enemy", {
				aiPattern: [legacyEnemies[0].ability.id],
			}),
		],
		items: [],
		canEscape: true,
	};
}

export const createDemoEncounterProvider = (
	registry?: GameContentRegistry,
): EncounterProvider =>
	registry
		? (encounterId, party, inventory) =>
				createBattleStateFromEncounter(registry, encounterId, party, inventory)
		: (encounterId, party) => {
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
	const party = createInitialPartyState(options.registry);
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
		field: createFieldStateAt(
			entrance.position,
			entrance.facing,
			party.members.length,
			(point) =>
				point.x >= 0 &&
				point.y >= 0 &&
				point.x < map.width &&
				point.y < map.height &&
				!options.registry.isCollision(map.id, point.x, point.y),
		),
		event: null,
		party,
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
