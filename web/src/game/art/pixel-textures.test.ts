import { describe, expect, it } from "vitest";
import {
	FIELD_CHARACTER_TEXTURE_HEIGHT,
	FIELD_CHARACTER_TEXTURE_WIDTH,
	getBattleCharacterTextureKey,
	getFieldCharacterTextureKey,
} from "./pixel-textures";

describe("field character texture keys", () => {
	it("uses a higher-detail 16-bit character canvas", () => {
		expect(FIELD_CHARACTER_TEXTURE_WIDTH).toBe(32);
		expect(FIELD_CHARACTER_TEXTURE_HEIGHT).toBe(40);
	});

	it("selects directional idle and alternating walk frames", () => {
		expect(getFieldCharacterTextureKey("field-mira", "DOWN", 0)).toBe(
			"field-mira-down-0",
		);
		expect(getFieldCharacterTextureKey("field-mira", "UP", 1)).toBe(
			"field-mira-up-1",
		);
		expect(getFieldCharacterTextureKey("field-mira", "RIGHT", 2)).toBe(
			"field-mira-side-2",
		);
		expect(getFieldCharacterTextureKey("field-mira", "LEFT", 1)).toBe(
			"field-mira-side-1",
		);
	});

	it("uses the side-facing idle frame for battle", () => {
		expect(getBattleCharacterTextureKey("field-mira")).toBe(
			"field-mira-side-0",
		);
	});
});
