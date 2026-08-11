import type {
	AbilityContentDefinitionV1,
	ActorDefinitionV1,
	AssetDefinitionV1,
	CharacterDefinitionV1,
	ContentManifestV1,
	EncounterDefinitionV1,
	EnemyDefinitionV1,
	EquipmentDefinitionV1,
	EventDefinitionV1,
	ItemDefinitionV1,
	MapDefinitionV1,
	StatusEffectDefinitionV1,
} from "./schema";

const deepFreeze = <T>(value: T): T => {
	if (value && typeof value === "object" && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value as Record<string, unknown>)) {
			deepFreeze(child);
		}
	}
	return value;
};

const indexById = <T extends { id: string }>(
	values: readonly T[],
): Readonly<Record<string, T>> => {
	const index = Object.create(null) as Record<string, T>;
	for (const value of values) index[value.id] = value;
	return deepFreeze(index);
};

export class GameContentRegistry {
	readonly contentVersion: string;
	readonly entryPoint: Readonly<ContentManifestV1["entryPoint"]>;
	readonly mapsById: Readonly<Record<string, MapDefinitionV1>>;
	readonly eventsById: Readonly<Record<string, EventDefinitionV1>>;
	readonly assetsById: Readonly<Record<string, AssetDefinitionV1>>;
	readonly actorsById: Readonly<Record<string, ActorDefinitionV1>>;
	readonly statusEffectsById: Readonly<
		Record<string, StatusEffectDefinitionV1>
	>;
	readonly abilitiesById: Readonly<Record<string, AbilityContentDefinitionV1>>;
	readonly charactersById: Readonly<Record<string, CharacterDefinitionV1>>;
	readonly itemsById: Readonly<Record<string, ItemDefinitionV1>>;
	readonly equipmentById: Readonly<Record<string, EquipmentDefinitionV1>>;
	readonly enemiesById: Readonly<Record<string, EnemyDefinitionV1>>;
	readonly encountersById: Readonly<Record<string, EncounterDefinitionV1>>;
	readonly assets: readonly AssetDefinitionV1[];
	readonly encounterIds: readonly string[];
	private readonly collisionKeysByMap: Readonly<
		Record<string, ReadonlySet<string>>
	>;

	constructor(options: {
		manifest: ContentManifestV1;
		maps: readonly MapDefinitionV1[];
		events: readonly EventDefinitionV1[];
	}) {
		const manifest = deepFreeze(structuredClone(options.manifest));
		const maps = options.maps.map((map) => deepFreeze(structuredClone(map)));
		const events = options.events.map((event) =>
			deepFreeze(structuredClone(event)),
		);
		this.contentVersion = manifest.contentVersion;
		this.entryPoint = manifest.entryPoint;
		this.mapsById = indexById(maps);
		this.eventsById = indexById(events);
		this.assets = deepFreeze(manifest.assets.map((asset) => ({ ...asset })));
		this.assetsById = indexById(this.assets);
		this.actorsById = indexById(manifest.actors);
		this.statusEffectsById = indexById(manifest.statusEffects);
		this.abilitiesById = indexById(manifest.abilities);
		this.charactersById = indexById(manifest.characters);
		this.itemsById = indexById(manifest.items);
		this.equipmentById = indexById(manifest.equipment);
		this.enemiesById = indexById(manifest.enemies);
		this.encountersById = indexById(manifest.encounters);
		this.encounterIds = deepFreeze([
			...new Set([
				...manifest.encounterIds,
				...manifest.encounters.map(({ id }) => id),
			]),
		]);
		const collisionKeysByMap = Object.create(null) as Record<
			string,
			ReadonlySet<string>
		>;
		for (const map of maps) {
			const keys = new Set<string>();
			for (const region of map.collisionRegions) {
				for (let y = region.y; y < region.y + region.height; y += 1) {
					for (let x = region.x; x < region.x + region.width; x += 1) {
						keys.add(`${x},${y}`);
					}
				}
			}
			collisionKeysByMap[map.id] = keys;
		}
		this.collisionKeysByMap = Object.freeze(collisionKeysByMap);
		Object.freeze(this);
	}

	getMap(mapId: string): MapDefinitionV1 {
		const map = this.mapsById[mapId];
		if (!map) throw new Error(`Unknown map '${mapId}'.`);
		return map;
	}

	getEvent(eventId: string): EventDefinitionV1 {
		const event = this.eventsById[eventId];
		if (!event) throw new Error(`Unknown event '${eventId}'.`);
		return event;
	}

	getAsset(assetId: string): AssetDefinitionV1 {
		const asset = this.assetsById[assetId];
		if (!asset) throw new Error(`Unknown asset '${assetId}'.`);
		return asset;
	}

	getActor(actorId: string): ActorDefinitionV1 {
		const actor = this.actorsById[actorId];
		if (!actor) throw new Error(`Unknown actor '${actorId}'.`);
		return actor;
	}

	getStatusEffect(statusEffectId: string): StatusEffectDefinitionV1 {
		const statusEffect = this.statusEffectsById[statusEffectId];
		if (!statusEffect)
			throw new Error(`Unknown status effect '${statusEffectId}'.`);
		return statusEffect;
	}

	getAbility(abilityId: string): AbilityContentDefinitionV1 {
		const ability = this.abilitiesById[abilityId];
		if (!ability) throw new Error(`Unknown ability '${abilityId}'.`);
		return ability;
	}

	getCharacter(characterId: string): CharacterDefinitionV1 {
		const character = this.charactersById[characterId];
		if (!character) throw new Error(`Unknown character '${characterId}'.`);
		return character;
	}

	getItem(itemId: string): ItemDefinitionV1 {
		const item = this.itemsById[itemId];
		if (!item) throw new Error(`Unknown item '${itemId}'.`);
		return item;
	}

	getEquipment(equipmentId: string): EquipmentDefinitionV1 {
		const equipment = this.equipmentById[equipmentId];
		if (!equipment) throw new Error(`Unknown equipment '${equipmentId}'.`);
		return equipment;
	}

	getEnemy(enemyId: string): EnemyDefinitionV1 {
		const enemy = this.enemiesById[enemyId];
		if (!enemy) throw new Error(`Unknown enemy '${enemyId}'.`);
		return enemy;
	}

	getEncounter(encounterId: string): EncounterDefinitionV1 {
		const encounter = this.encountersById[encounterId];
		if (!encounter) throw new Error(`Unknown encounter '${encounterId}'.`);
		return encounter;
	}

	hasEncounter(encounterId: string): boolean {
		return this.encounterIds.includes(encounterId);
	}

	isCollision(mapId: string, x: number, y: number): boolean {
		return this.collisionKeysByMap[mapId]?.has(`${x},${y}`) ?? false;
	}
}
