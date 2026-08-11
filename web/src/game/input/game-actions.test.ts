import { describe, expect, it } from "vitest";
import { normalizeKeyboardBinding } from "./game-actions";

describe("normalizeKeyboardBinding", () => {
	it("normalizes configurable keyboard keys for Phaser", () => {
		expect(normalizeKeyboardBinding("ArrowUp")).toBe("UP");
		expect(normalizeKeyboardBinding("Escape")).toBe("ESC");
		expect(normalizeKeyboardBinding(" ")).toBe("SPACE");
		expect(normalizeKeyboardBinding("z")).toBe("Z");
		expect(normalizeKeyboardBinding("F1")).toBeNull();
	});
});
