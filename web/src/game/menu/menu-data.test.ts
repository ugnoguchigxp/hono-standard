import { describe, expect, it } from "vitest";
import { validateGameContentDirectory } from "../../../../scripts/validate-game-content";
import { createInitialGameState } from "@shared/game";
import {
	equipmentSlots,
	equipmentSlotLabel,
	getCharacterJob,
	getEquipmentRows,
	getFieldMenuItems,
	nextEquipmentCandidate,
} from "./menu-data";

const registry = validateGameContentDirectory();

describe("field menu domain-backed data", () => {
	it("reads classic RPG jobs and equipment from validated content", () => {
		const state = createInitialGameState({ registry });
		expect(getCharacterJob(registry, "mira")).toBe("HERO");
		expect(getCharacterJob(registry, "sol")).toBe("WARRIOR");
		expect(getCharacterJob(registry, "lune")).toBe("MAGE");
		expect(getCharacterJob(registry, "missing")).toBe("ADVENTURER");
		expect(equipmentSlots).toEqual(["weapon", "armor", "off-hand", "relic"]);
		expect(equipmentSlotLabel("off-hand")).toBe("OFF-HAND");
		expect(
			getEquipmentRows(registry, state.party.equipment.mira).map(
				({ name }) => name,
			),
		).toEqual(["Rune Blade", "Dawn Mail", "Signal Guard", "—"]);
	});

	it("reads persisted item quantities and compatible equipment choices", () => {
		const state = createInitialGameState({ registry });
		state.party.inventory["missing-item"] = 1;
		state.party.inventory.antidote = 0;
		state.party.equipmentInventory["missing-equipment"] = 1;
		const items = getFieldMenuItems(state, registry);
		expect(items.find(({ id }) => id === "potion")).toMatchObject({
			count: 5,
			usable: true,
		});
		expect(items.find(({ id }) => id === "echo-shard")?.usable).toBe(false);
		expect(items.some(({ id }) => id === "missing-item")).toBe(false);
		expect(items.some(({ id }) => id === "antidote")).toBe(false);
		expect(nextEquipmentCandidate(state, registry, "mira", "weapon")).toBe(
			"tempered-blade",
		);
		state.party.equipment.mira.weapon = "tempered-blade";
		state.party.equipmentInventory["rune-blade"] = 1;
		delete state.party.equipmentInventory["tempered-blade"];
		expect(nextEquipmentCandidate(state, registry, "mira", "weapon")).toBeNull();
		state.party.equipment.mira.weapon = null;
		state.party.equipmentInventory["tempered-blade"] = 1;
		expect(nextEquipmentCandidate(state, registry, "mira", "weapon")).toBe(
			"rune-blade",
		);
		expect(nextEquipmentCandidate(state, registry, "sol", "weapon")).toBeNull();
	});
});
