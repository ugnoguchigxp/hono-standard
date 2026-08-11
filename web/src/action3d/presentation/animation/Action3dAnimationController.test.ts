import type { Action3dAsset } from "@shared/action3d";
import { describe, expect, it, vi } from "vitest";
import {
	type Action3dAnimationHandle,
	createAction3dAnimationController,
} from "./Action3dAnimationController";

const asset = {
	type: "model",
	model: {
		clips: [
			{ id: "idle", name: "Idle", loop: true, durationMs: { min: 1, max: 2 } },
			{ id: "attack-1", name: "Attack1", loop: false, durationMs: { min: 1, max: 2 } },
		],
	},
} as Extract<Action3dAsset, { type: "model" }>;
const handle = (name: string) =>
	({
		name,
		play: vi.fn(),
		stop: vi.fn(),
		setWeight: vi.fn(),
	}) satisfies Action3dAnimationHandle;

describe("Action3dAnimationController", () => {
	it("crossfades without restarting the same logical revision", () => {
		const idle = handle("Idle");
		const attack = handle("Attack1");
		const controller = createAction3dAnimationController(
			asset,
			[idle, attack],
			100,
		);
		expect(controller.select("idle")).toBe(true);
		expect(controller.select("idle")).toBe(false);
		expect(idle.play).toHaveBeenCalledTimes(1);
		expect(idle.play).toHaveBeenCalledWith(true);

		expect(controller.select("attack-1", "attack-7")).toBe(true);
		expect(attack.play).toHaveBeenCalledWith(false);
		controller.update(40);
		expect(attack.setWeight).toHaveBeenLastCalledWith(0.4);
		expect(idle.setWeight).toHaveBeenLastCalledWith(0.6);
		controller.update(60);
		expect(idle.stop).toHaveBeenCalledTimes(1);
		expect(controller.activeId).toBe("attack-1");
	});

	it("restarts a one-shot only for a new revision and disposes both sides", () => {
		const idle = handle("Idle");
		const attack = handle("Attack1");
		const controller = createAction3dAnimationController(
			asset,
			[idle, attack],
			100,
		);
		controller.select("attack-1", "attack-1");
		expect(controller.select("attack-1", "attack-1")).toBe(false);
		expect(controller.select("attack-1", "attack-2")).toBe(true);
		expect(attack.play).toHaveBeenCalledTimes(2);
		controller.dispose();
		expect(attack.stop).toHaveBeenCalled();
		expect(controller.select("idle")).toBe(false);
	});

	it("fails loudly when the contract and imported groups disagree", () => {
		const controller = createAction3dAnimationController(asset, []);
		expect(() => controller.select("idle")).toThrow("group 'Idle' is missing");
		expect(() => controller.select("missing")).toThrow("clip 'missing'");
	});
});
