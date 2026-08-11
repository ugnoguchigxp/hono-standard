import { describe, expect, it } from "vitest";
import { battleEnemyPosition, battlePartyPosition } from "./battle-layout";

describe("battle layout", () => {
	it("keeps the three-member party in its fixed logical rows", () => {
		expect([0, 1, 2].map(battlePartyPosition)).toEqual([
			{ x: 272, y: 62, scale: 0.88 },
			{ x: 272, y: 94, scale: 0.88 },
			{ x: 272, y: 126, scale: 0.88 },
		]);
	});

	it("uses a centered boss slot and bounded fallback enemy rows", () => {
		expect(battleEnemyPosition(true, 0)).toEqual({
			x: 92,
			y: 124,
			scale: 0.88,
		});
		expect(battleEnemyPosition(false, 6)).toEqual({
			x: 76,
			y: 114,
			scale: 0.92,
		});
	});
});
