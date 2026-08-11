import { describe, expect, it } from "vitest";
import { Action3dInputController } from "./Action3dInputController";

describe("Action3dInputController", () => {
	it("emits Q as a heavy-attack edge and clears it after the read", () => {
		const canvas = document.createElement("canvas");
		document.body.append(canvas);
		const controller = new Action3dInputController(canvas, () => undefined);
		window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyQ" }));
		expect(controller.read().heavyAttack).toBe(true);
		expect(controller.read().heavyAttack).toBe(false);
		window.dispatchEvent(new Event("blur"));
		expect(controller.read().heavyAttack).toBe(false);
		controller.dispose();
		canvas.remove();
	});
});
