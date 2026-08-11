import { describe, expect, it } from "vitest";
import { validateGameContentDirectory } from "../../scripts/validate-game-content";
import type { CharacterDefinitionV1 } from "./content";
import {
	calculateCharacterStats,
	changePartyEquipment,
	consumePartyItem,
	createCharacterState,
	createEmptyEquipment,
	createInitialPartyState,
	experienceRequiredForLevel,
	grantExperience,
	levelForExperience,
	recalculateCharacter,
	toRuntimeAbility,
} from "./progression-engine";

const registry = validateGameContentDirectory();

describe("progression engine", () => {
	it("normalizes experience into the supported level range", () => {
		expect(experienceRequiredForLevel(Number.NaN)).toBe(0);
		expect(experienceRequiredForLevel(Number.POSITIVE_INFINITY)).toBe(240_100);
		expect(experienceRequiredForLevel(-4)).toBe(0);
		expect(experienceRequiredForLevel(2)).toBe(100);
		expect(experienceRequiredForLevel(99)).toBe(240_100);
		expect(levelForExperience(-1)).toBe(1);
		expect(levelForExperience(99)).toBe(1);
		expect(levelForExperience(100.9)).toBe(2);
		expect(levelForExperience(Number.POSITIVE_INFINITY)).toBe(50);
		expect(levelForExperience(Number.NaN)).toBe(1);
		expect(levelForExperience(999_999)).toBe(50);
	});

	it("builds content-backed abilities, party inventory, and equipment stats", () => {
		const plain = toRuntimeAbility(registry.getAbility("arc-slash"), registry);
		const status = toRuntimeAbility(registry.getAbility("guard-break"), registry);
		expect(plain.statusEffect).toBeUndefined();
		expect(plain.statusChance).toBeUndefined();
		expect(status.statusEffect).toMatchObject({ id: "exposed", defensePercent: -30 });
		expect(status.statusChance).toBe(1);

		const party = createInitialPartyState(registry);
		expect(party.inventory).toMatchObject({ potion: 5, ether: 3 });
		expect(party.equipmentInventory).toEqual({
			"relay-pendant": 1,
			"tempered-blade": 1,
			"swift-band": 1,
		});
		expect(party.members.map(({ id }) => id)).toEqual(["mira", "sol", "lune"]);
		expect(createEmptyEquipment()).toEqual({
			weapon: null,
			armor: null,
			"off-hand": null,
			relic: null,
		});
	});

	it("clamps calculated stats and rejects characters without an initial ability", () => {
		const source = registry.getCharacter("mira");
		const weakened: CharacterDefinitionV1 = {
			...source,
			baseStats: { maxHp: 1, maxMp: 0, attack: 1, defense: 0, speed: 1 },
			growthPerLevel: {
				maxHp: -100,
				maxMp: -100,
				attack: -100,
				defense: -100,
				speed: -100,
			},
		};
		expect(
			calculateCharacterStats(weakened, 2, createEmptyEquipment(), registry),
		).toEqual({ maxHp: 1, maxMp: 0, attack: 1, defense: 0, speed: 1 });

		expect(() =>
			createCharacterState(
				{ ...source, abilityUnlocks: [] },
				createEmptyEquipment(),
				registry,
			),
		).toThrow("has no ability");
	});

	it("preserves damage deficits while leveling and reports learned abilities", () => {
		const party = createInitialPartyState(registry);
		const mira = { ...party.members[0], hp: party.members[0].hp - 7, mp: 2 };
		const leveled = grantExperience(
			mira,
			100,
			party.equipment.mira,
			registry,
		);
		expect(leveled.member.level).toBe(2);
		expect(leveled.member.maxHp - leveled.member.hp).toBe(7);
		expect(leveled.member.maxMp - leveled.member.mp).toBe(mira.maxMp - mira.mp);
		expect(leveled.events).toEqual([
			{
				type: "party.experience.gained",
				actorId: "mira",
				amount: 100,
				total: 100,
			},
			{
				type: "party.level.gained",
				actorId: "mira",
				previousLevel: 1,
				level: 2,
			},
			{
				type: "party.ability.learned",
				actorId: "mira",
				abilityId: "rallying-light",
			},
		]);

		const unchanged = grantExperience(
			leveled.member,
			-50,
			party.equipment.mira,
			registry,
		);
		expect(unchanged.member.level).toBe(2);
		expect(unchanged.events).toHaveLength(1);

		const depleted = recalculateCharacter(
			{ ...mira, hp: 0, mp: 0, maxHp: 999, maxMp: 999 },
			party.equipment.mira,
			registry,
		);
		expect(depleted.hp).toBe(0);
		expect(depleted.mp).toBe(0);
	});

	it("consumes HP, MP, and revival items only when they have an effect", () => {
		let party = createInitialPartyState(registry);
		expect(consumePartyItem(party, "missing", "mira", registry)).toBeNull();
		expect(consumePartyItem(party, "echo-shard", "mira", registry)).toBeNull();
		expect(consumePartyItem(party, "potion", "missing", registry)).toBeNull();
		expect(consumePartyItem(party, "potion", "mira", registry)).toBeNull();

		party = {
			...party,
			members: party.members.map((member) =>
				member.id === "mira" ? { ...member, hp: 1, mp: 0 } : member,
			),
		};
		const potion = consumePartyItem(party, "potion", "mira", registry);
		expect(potion).not.toBeNull();
		expect(potion?.amount).toBe(50);
		expect(potion?.party.inventory.potion).toBe(4);
		party = potion?.party ?? party;

		const ether = consumePartyItem(party, "ether", "mira", registry);
		expect(ether?.amount).toBe(party.members[0].maxMp);
		party = {
			...(ether?.party ?? party),
			inventory: { ...(ether?.party.inventory ?? party.inventory), "phoenix-feather": 1 },
			members: (ether?.party.members ?? party.members).map((member) =>
				member.id === "mira" ? { ...member, hp: 0 } : member,
			),
		};
		const revived = consumePartyItem(
			party,
			"phoenix-feather",
			"mira",
			registry,
		);
		expect(revived?.amount).toBeGreaterThan(0);
		expect(revived?.party.inventory["phoenix-feather"]).toBeUndefined();
	});

	it("validates, equips, swaps, and removes equipment", () => {
		let party = createInitialPartyState(registry);
		expect(
			changePartyEquipment(party, "missing", "weapon", null, registry),
		).toBeNull();
		expect(
			changePartyEquipment(party, "mira", "weapon", "rune-blade", registry),
		).toBeNull();
		expect(
			changePartyEquipment(party, "mira", "armor", "tempered-blade", registry),
		).toBeNull();
		expect(
			changePartyEquipment(party, "sol", "weapon", "tempered-blade", registry),
		).toBeNull();
		const noStock = {
			...party,
			equipmentInventory: { ...party.equipmentInventory, "tempered-blade": 0 },
		};
		expect(
			changePartyEquipment(
				noStock,
				"mira",
				"weapon",
				"tempered-blade",
				registry,
			),
		).toBeNull();

		const equipped = changePartyEquipment(
			party,
			"mira",
			"weapon",
			"tempered-blade",
			registry,
		);
		expect(equipped?.equipmentInventory["tempered-blade"]).toBeUndefined();
		expect(equipped?.equipmentInventory["rune-blade"]).toBe(1);
		expect(equipped?.members[0].attack).toBeGreaterThan(party.members[0].attack);
		party = equipped ?? party;
		const removed = changePartyEquipment(
			party,
			"mira",
			"weapon",
			null,
			registry,
		);
		expect(removed?.equipment.mira.weapon).toBeNull();
		expect(removed?.equipmentInventory["tempered-blade"]).toBe(1);

		const noLoadout = createInitialPartyState(registry);
		delete noLoadout.equipment.mira;
		noLoadout.equipmentInventory["relay-pendant"] = 2;
		const equippedFromEmpty = changePartyEquipment(
			noLoadout,
			"mira",
			"relic",
			"relay-pendant",
			registry,
		);
		expect(equippedFromEmpty?.equipment.mira.relic).toBe("relay-pendant");
		expect(equippedFromEmpty?.equipmentInventory["relay-pendant"]).toBe(1);

		const missingStock = createInitialPartyState(registry);
		delete missingStock.equipmentInventory["tempered-blade"];
		expect(
			changePartyEquipment(
				missingStock,
				"mira",
				"weapon",
				"tempered-blade",
				registry,
			),
		).toBeNull();
	});
});
