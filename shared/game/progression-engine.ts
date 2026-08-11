import type {
	AbilityContentDefinitionV1,
	CharacterDefinitionV1,
	GameContentRegistry,
} from "./content";
import type {
	AbilityDefinition,
	CharacterEquipmentState,
	CharacterState,
	EquipmentSlot,
	GameSessionEvent,
	PartyState,
} from "./model";

export const MAX_CHARACTER_LEVEL = 50;

export const createEmptyEquipment = (): CharacterEquipmentState => ({
	weapon: null,
	armor: null,
	"off-hand": null,
	relic: null,
});

export const experienceRequiredForLevel = (level: number): number => {
	const finiteLevel = Number.isFinite(level)
		? Math.floor(level)
		: level === Number.POSITIVE_INFINITY
			? MAX_CHARACTER_LEVEL
			: 1;
	const normalized = Math.max(1, Math.min(MAX_CHARACTER_LEVEL, finiteLevel));
	return normalized <= 1 ? 0 : 100 * (normalized - 1) ** 2;
};

export const levelForExperience = (experience: number): number => {
	const total = Number.isFinite(experience)
		? Math.max(0, Math.floor(experience))
		: experience === Number.POSITIVE_INFINITY
			? Number.MAX_SAFE_INTEGER
			: 0;
	let level = 1;
	while (
		level < MAX_CHARACTER_LEVEL &&
		total >= experienceRequiredForLevel(level + 1)
	) {
		level += 1;
	}
	return level;
};

export const toRuntimeAbility = (
	definition: AbilityContentDefinitionV1,
	registry: GameContentRegistry,
): AbilityDefinition => ({
	id: definition.id,
	name: definition.displayName,
	description: definition.description,
	kind: definition.kind,
	target: definition.target,
	powerPercent: definition.powerPercent,
	mpCost: definition.mpCost,
	element: definition.element,
	...(definition.statusEffectId
		? {
				statusEffect: (() => {
					const status = registry.getStatusEffect(definition.statusEffectId);
					return {
						id: status.id,
						name: status.displayName,
						description: status.description,
						polarity: status.polarity,
						durationTurns: status.durationTurns,
						attackPercent: status.attackPercent,
						defensePercent: status.defensePercent,
						speedPercent: status.speedPercent,
						damagePercentMaxHp: status.damagePercentMaxHp,
					};
				})(),
			}
		: {}),
	...(definition.statusChance === undefined
		? {}
		: { statusChance: definition.statusChance }),
});

const learnedAbilities = (
	definition: CharacterDefinitionV1,
	level: number,
	registry: GameContentRegistry,
): AbilityDefinition[] =>
	definition.abilityUnlocks
		.filter((unlock) => unlock.level <= level)
		.sort(
			(left, right) =>
				left.level - right.level ||
				left.abilityId.localeCompare(right.abilityId),
		)
		.map((unlock) =>
			toRuntimeAbility(registry.getAbility(unlock.abilityId), registry),
		);

const equipmentBonuses = (
	loadout: CharacterEquipmentState,
	registry: GameContentRegistry,
) => {
	const total = { maxHp: 0, maxMp: 0, attack: 0, defense: 0, speed: 0 };
	for (const equipmentId of Object.values(loadout)) {
		if (!equipmentId) continue;
		const modifiers = registry.getEquipment(equipmentId).modifiers;
		total.maxHp += modifiers.maxHp;
		total.maxMp += modifiers.maxMp;
		total.attack += modifiers.attack;
		total.defense += modifiers.defense;
		total.speed += modifiers.speed;
	}
	return total;
};

export const calculateCharacterStats = (
	definition: CharacterDefinitionV1,
	level: number,
	loadout: CharacterEquipmentState,
	registry: GameContentRegistry,
) => {
	const levelOffset = Math.max(0, level - 1);
	const bonuses = equipmentBonuses(loadout, registry);
	return {
		maxHp: Math.max(
			1,
			definition.baseStats.maxHp +
				definition.growthPerLevel.maxHp * levelOffset +
				bonuses.maxHp,
		),
		maxMp: Math.max(
			0,
			definition.baseStats.maxMp +
				definition.growthPerLevel.maxMp * levelOffset +
				bonuses.maxMp,
		),
		attack: Math.max(
			1,
			definition.baseStats.attack +
				definition.growthPerLevel.attack * levelOffset +
				bonuses.attack,
		),
		defense: Math.max(
			0,
			definition.baseStats.defense +
				definition.growthPerLevel.defense * levelOffset +
				bonuses.defense,
		),
		speed: Math.max(
			1,
			definition.baseStats.speed +
				definition.growthPerLevel.speed * levelOffset +
				bonuses.speed,
		),
	};
};

export const createCharacterState = (
	definition: CharacterDefinitionV1,
	loadout: CharacterEquipmentState,
	registry: GameContentRegistry,
): CharacterState => {
	const experience = experienceRequiredForLevel(definition.initialLevel);
	const level = levelForExperience(experience);
	const stats = calculateCharacterStats(definition, level, loadout, registry);
	const abilities = learnedAbilities(definition, level, registry);
	if (!abilities[0]) {
		throw new Error(
			`Character '${definition.id}' has no ability at level ${level}.`,
		);
	}
	return {
		id: definition.id,
		name: registry.getActor(definition.id).displayName,
		level,
		experience,
		hp: stats.maxHp,
		maxHp: stats.maxHp,
		mp: stats.maxMp,
		maxMp: stats.maxMp,
		attack: stats.attack,
		defense: stats.defense,
		speed: stats.speed,
		ability: abilities[0],
		abilities,
	};
};

export const createInitialPartyState = (
	registry: GameContentRegistry,
): PartyState => {
	const equipment = Object.fromEntries(
		Object.values(registry.charactersById).map((definition) => [
			definition.id,
			{ ...definition.initialEquipment },
		]),
	);
	const inventory = Object.fromEntries(
		Object.values(registry.itemsById)
			.filter(({ initialQuantity }) => initialQuantity > 0)
			.map(({ id, initialQuantity }) => [id, initialQuantity]),
	);
	const equipmentInventory = Object.fromEntries(
		Object.values(registry.equipmentById)
			.filter(({ initialQuantity }) => initialQuantity > 0)
			.map(({ id, initialQuantity }) => [id, initialQuantity]),
	);
	return {
		members: Object.values(registry.charactersById).map((definition) =>
			createCharacterState(definition, equipment[definition.id], registry),
		),
		inventory,
		equipmentInventory,
		equipment,
	};
};

export const recalculateCharacter = (
	character: CharacterState,
	loadout: CharacterEquipmentState,
	registry: GameContentRegistry,
): CharacterState => {
	const definition = registry.getCharacter(character.id);
	const level = levelForExperience(character.experience);
	const stats = calculateCharacterStats(definition, level, loadout, registry);
	const abilities = learnedAbilities(definition, level, registry);
	const hpDeficit = Math.max(0, character.maxHp - character.hp);
	const mpDeficit = Math.max(0, character.maxMp - character.mp);
	return {
		...character,
		level,
		hp: Math.max(0, stats.maxHp - hpDeficit),
		maxHp: stats.maxHp,
		mp: Math.max(0, stats.maxMp - mpDeficit),
		maxMp: stats.maxMp,
		attack: stats.attack,
		defense: stats.defense,
		speed: stats.speed,
		ability: abilities[0],
		abilities,
	};
};

export type ExperienceGainResult = {
	member: CharacterState;
	events: GameSessionEvent[];
};

export const grantExperience = (
	character: CharacterState,
	amount: number,
	loadout: CharacterEquipmentState,
	registry: GameContentRegistry,
): ExperienceGainResult => {
	const safeAmount = Math.max(0, Math.floor(amount));
	const previousLevel = character.level;
	const previousAbilityIds = new Set(character.abilities.map(({ id }) => id));
	const member = recalculateCharacter(
		{ ...character, experience: character.experience + safeAmount },
		loadout,
		registry,
	);
	const events: GameSessionEvent[] = [
		{
			type: "party.experience.gained",
			actorId: member.id,
			amount: safeAmount,
			total: member.experience,
		},
	];
	if (member.level > previousLevel) {
		events.push({
			type: "party.level.gained",
			actorId: member.id,
			previousLevel,
			level: member.level,
		});
		for (const ability of member.abilities) {
			if (!previousAbilityIds.has(ability.id)) {
				events.push({
					type: "party.ability.learned",
					actorId: member.id,
					abilityId: ability.id,
				});
			}
		}
	}
	return { member, events };
};

export type PartyItemUseResult = {
	party: PartyState;
	amount: number;
};

export const consumePartyItem = (
	party: PartyState,
	itemId: string,
	targetId: string,
	registry: GameContentRegistry,
): PartyItemUseResult | null => {
	if ((party.inventory[itemId] ?? 0) <= 0) return null;
	const item = registry.getItem(itemId);
	if (item.kind !== "consumable" || item.effect === "none") return null;
	const targetIndex = party.members.findIndex(({ id }) => id === targetId);
	if (targetIndex < 0) return null;
	const target = party.members[targetIndex];
	let amount = 0;
	let nextTarget = target;
	if (
		item.effect === "restore-hp" &&
		target.hp > 0 &&
		target.hp < target.maxHp
	) {
		amount = Math.min(item.power, target.maxHp - target.hp);
		nextTarget = { ...target, hp: target.hp + amount };
	} else if (
		item.effect === "restore-mp" &&
		target.hp > 0 &&
		target.mp < target.maxMp
	) {
		amount = Math.min(item.power, target.maxMp - target.mp);
		nextTarget = { ...target, mp: target.mp + amount };
	} else if (item.effect === "revive" && target.hp === 0) {
		amount = Math.max(1, Math.floor((target.maxHp * item.power) / 100));
		nextTarget = { ...target, hp: amount };
	} else {
		return null;
	}
	const inventory = {
		...party.inventory,
		[itemId]: party.inventory[itemId] - 1,
	};
	if (inventory[itemId] <= 0) delete inventory[itemId];
	const members = party.members.map((member, index) =>
		index === targetIndex ? nextTarget : member,
	);
	return { party: { ...party, inventory, members }, amount };
};

export const changePartyEquipment = (
	party: PartyState,
	actorId: string,
	slot: EquipmentSlot,
	equipmentId: string | null,
	registry: GameContentRegistry,
): PartyState | null => {
	const memberIndex = party.members.findIndex(({ id }) => id === actorId);
	if (memberIndex < 0) return null;
	const currentLoadout = party.equipment[actorId] ?? createEmptyEquipment();
	const previousEquipmentId = currentLoadout[slot];
	if (previousEquipmentId === equipmentId) return null;
	if (equipmentId) {
		const definition = registry.getEquipment(equipmentId);
		if (
			definition.slot !== slot ||
			!definition.actorIds.includes(actorId) ||
			(party.equipmentInventory[equipmentId] ?? 0) <= 0
		) {
			return null;
		}
	}
	const equipmentInventory = { ...party.equipmentInventory };
	if (previousEquipmentId) {
		equipmentInventory[previousEquipmentId] =
			(equipmentInventory[previousEquipmentId] ?? 0) + 1;
	}
	if (equipmentId) {
		equipmentInventory[equipmentId] -= 1;
		if (equipmentInventory[equipmentId] <= 0)
			delete equipmentInventory[equipmentId];
	}
	const loadout = { ...currentLoadout, [slot]: equipmentId };
	const equipment = { ...party.equipment, [actorId]: loadout };
	const members = party.members.map((member, index) =>
		index === memberIndex
			? recalculateCharacter(member, loadout, registry)
			: member,
	);
	return { ...party, equipmentInventory, equipment, members };
};
