import type {
	CharacterEquipmentState,
	EquipmentSlot,
	GameContentRegistry,
	GameState,
} from "@shared/game";

export const equipmentSlots: readonly EquipmentSlot[] = [
	"weapon",
	"armor",
	"off-hand",
	"relic",
];

export const equipmentSlotLabel = (slot: EquipmentSlot): string =>
	slot.toUpperCase();

export type FieldMenuItem = {
	id: string;
	name: string;
	count: number;
	description: string;
	usable: boolean;
};

export const getFieldMenuItems = (
	state: GameState,
	registry: GameContentRegistry,
): FieldMenuItem[] =>
	Object.entries(state.party.inventory)
		.filter(([, count]) => count > 0)
		.flatMap(([itemId, count]) => {
			const item = registry.itemsById[itemId];
			if (!item) return [];
			return [
				{
					id: item.id,
					name: item.displayName,
					count,
					description: item.description,
					usable: item.kind === "consumable" && item.effect !== "none",
				},
			];
		})
		.sort((left, right) => left.name.localeCompare(right.name));

export const getCharacterJob = (
	registry: GameContentRegistry,
	actorId: string,
): string => registry.charactersById[actorId]?.job ?? "ADVENTURER";

export type FieldEquipmentRow = {
	slot: EquipmentSlot;
	equipmentId: string | null;
	name: string;
	description: string;
};

export const getEquipmentRows = (
	registry: GameContentRegistry,
	loadout: CharacterEquipmentState,
): FieldEquipmentRow[] =>
	equipmentSlots.map((slot) => {
		const equipmentId = loadout[slot];
		const definition = equipmentId
			? registry.equipmentById[equipmentId]
			: undefined;
		return {
			slot,
			equipmentId,
			name: definition?.displayName ?? "—",
			description: definition?.description ?? "Nothing equipped.",
		};
	});

export const nextEquipmentCandidate = (
	state: GameState,
	registry: GameContentRegistry,
	actorId: string,
	slot: EquipmentSlot,
): string | null => {
	const current = state.party.equipment[actorId]?.[slot] ?? null;
	const compatible = Object.entries(state.party.equipmentInventory)
		.filter(([, count]) => count > 0)
		.map(([equipmentId]) => registry.equipmentById[equipmentId])
		.filter(
			(definition) =>
				definition?.slot === slot && definition.actorIds.includes(actorId),
		)
		.map(({ id }) => id);
	const cycle: Array<string | null> = [
		...new Set([...(current ? [current] : []), ...compatible]),
	].sort();
	cycle.push(null);
	const currentIndex = cycle.indexOf(current);
	return cycle[(currentIndex + 1) % cycle.length] ?? null;
};
