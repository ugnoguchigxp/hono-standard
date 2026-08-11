export type EquipmentSlot = "WEAPON" | "ARMOR" | "OFF HAND" | "RELIC";

export type FieldMenuProfile = {
	job: string;
	equipment: ReadonlyArray<{
		slot: EquipmentSlot;
		name: string;
		description: string;
	}>;
};

export type FieldMenuItem = {
	id: string;
	name: string;
	count: number;
	description: string;
};

const fallbackProfile: FieldMenuProfile = {
	job: "ADVENTURER",
	equipment: [
		{
			slot: "WEAPON",
			name: "Traveler Blade",
			description: "A reliable road weapon.",
		},
		{ slot: "ARMOR", name: "Travel Clothes", description: "Light field gear." },
		{ slot: "OFF HAND", name: "—", description: "Nothing equipped." },
		{ slot: "RELIC", name: "—", description: "Nothing equipped." },
	],
};

export const fieldMenuProfiles: Readonly<Record<string, FieldMenuProfile>> = {
	mira: {
		job: "HERO",
		equipment: [
			{
				slot: "WEAPON",
				name: "Rune Blade",
				description: "A sword tuned to pale signals.",
			},
			{
				slot: "ARMOR",
				name: "Dawn Mail",
				description: "Balanced armor for a vanguard.",
			},
			{
				slot: "OFF HAND",
				name: "Signal Guard",
				description: "A compact runic shield.",
			},
			{
				slot: "RELIC",
				name: "Relay Pendant",
				description: "Keeps distant voices clear.",
			},
		],
	},
	sol: {
		job: "WARRIOR",
		equipment: [
			{
				slot: "WEAPON",
				name: "Steel Spear",
				description: "A heavy frontline polearm.",
			},
			{
				slot: "ARMOR",
				name: "Knight Plate",
				description: "Layered steel battle armor.",
			},
			{
				slot: "OFF HAND",
				name: "Guard Shield",
				description: "Built to absorb a charge.",
			},
			{
				slot: "RELIC",
				name: "Red Plume",
				description: "A veteran's field insignia.",
			},
		],
	},
	lune: {
		job: "MAGE",
		equipment: [
			{
				slot: "WEAPON",
				name: "Echo Staff",
				description: "Focuses resonant magic.",
			},
			{
				slot: "ARMOR",
				name: "Sage Robe",
				description: "A robe woven with warding thread.",
			},
			{
				slot: "OFF HAND",
				name: "Crystal Tome",
				description: "Stores recovered spell patterns.",
			},
			{
				slot: "RELIC",
				name: "Moon Charm",
				description: "Sharpens the bearer's senses.",
			},
		],
	},
};

export const fieldMenuItems: ReadonlyArray<FieldMenuItem> = [
	{
		id: "potion",
		name: "Potion",
		count: 5,
		description: "Restores 50 HP to one ally.",
	},
	{
		id: "hi-potion",
		name: "Hi-Potion",
		count: 2,
		description: "Restores 150 HP to one ally.",
	},
	{
		id: "antidote",
		name: "Antidote",
		count: 3,
		description: "Cures poison and ruin blight.",
	},
	{
		id: "phoenix-feather",
		name: "Phoenix Feather",
		count: 1,
		description: "Revives a fallen ally.",
	},
	{
		id: "echo-shard",
		name: "Echo Shard",
		count: 4,
		description: "A fragment carrying an old signal.",
	},
];

export const getFieldMenuProfile = (actorId: string): FieldMenuProfile =>
	fieldMenuProfiles[actorId] ?? fallbackProfile;
