import { describe, expect, it } from "vitest";
import {
	fieldMenuItems,
	fieldMenuProfiles,
	getFieldMenuProfile,
} from "./menu-data";

describe("field menu presentation data", () => {
	it("provides classic RPG jobs and four visible equipment slots", () => {
		expect(Object.keys(fieldMenuProfiles)).toEqual(["mira", "sol", "lune"]);
		expect(fieldMenuProfiles.mira.job).toBe("HERO");
		expect(fieldMenuProfiles.sol.job).toBe("WARRIOR");
		expect(fieldMenuProfiles.lune.job).toBe("MAGE");
		for (const profile of Object.values(fieldMenuProfiles)) {
			expect(profile.equipment.map(({ slot }) => slot)).toEqual([
				"WEAPON",
				"ARMOR",
				"OFF HAND",
				"RELIC",
			]);
		}
	});

	it("provides a non-empty view-only inventory and a safe fallback profile", () => {
		expect(fieldMenuItems.length).toBeGreaterThanOrEqual(5);
		expect(fieldMenuItems.every(({ count }) => count > 0)).toBe(true);
		expect(getFieldMenuProfile("missing").job).toBe("ADVENTURER");
	});
});
