import { afterEach, describe, expect, it, vi } from "vitest";
import { GameSettingsStore } from "../settings/GameSettingsStore";
import { dispatchVirtualGameInput } from "./game-actions";
import { InputManager } from "./InputManager";

vi.mock("phaser", () => ({
	default: {
		Input: {
			Keyboard: {
				JustDown: (key: { justDown?: boolean }) => {
					const justDown = Boolean(key.justDown);
					key.justDown = false;
					return justDown;
				},
			},
		},
	},
}));

const createInputManager = () => {
	const keys: Array<{
		binding: string;
		isDown: boolean;
		justDown?: boolean;
		destroy: ReturnType<typeof vi.fn>;
	}> = [];
	const keysByBinding = new Map<string, (typeof keys)[number]>();
	const keyboard = {
		addKey: vi.fn((binding: string) => {
			const key = { binding, isDown: false, destroy: vi.fn() };
			keys.push(key);
			keysByBinding.set(binding, key);
			return key;
		}),
	};
	const scene = { input: { keyboard } } as unknown as ConstructorParameters<
		typeof InputManager
	>[0];
	return {
		manager: new InputManager(scene, new GameSettingsStore()),
		keys,
		keysByBinding,
	};
};

afterEach(() => {
	document.querySelector(".game-settings-panel")?.remove();
	vi.unstubAllGlobals();
});

describe("InputManager", () => {
	it("turns a short virtual tap into exactly one frame edge", () => {
		const { manager, keys } = createInputManager();
		dispatchVirtualGameInput("CONFIRM", true);
		dispatchVirtualGameInput("CONFIRM", false);

		expect(manager.justPressed("CONFIRM")).toBe(false);
		manager.update();
		expect(manager.justPressed("CONFIRM")).toBe(true);
		manager.update();
		expect(manager.justPressed("CONFIRM")).toBe(false);

		manager.destroy();
		expect(keys.every(({ destroy }) => destroy.mock.calls.length === 1)).toBe(
			true,
		);
	});

	it("emits one edge per gamepad press while preserving held directions", () => {
		const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
		const gamepad = {
			connected: true,
			buttons,
			axes: [0, 0],
		};
		vi.stubGlobal("navigator", {
			getGamepads: () => [gamepad],
		});
		const { manager } = createInputManager();

		buttons[0].pressed = true;
		gamepad.axes[0] = 0.8;
		manager.update();
		expect(manager.justPressed("CONFIRM")).toBe(true);
		expect(manager.isDown("RIGHT")).toBe(true);
		manager.update();
		expect(manager.justPressed("CONFIRM")).toBe(false);
		const panel = document.createElement("section");
		panel.className = "game-settings-panel";
		document.body.append(panel);
		manager.update();
		expect(manager.justPressed("CONFIRM")).toBe(false);
		panel.remove();
		manager.update();
		expect(manager.justPressed("CONFIRM")).toBe(false);

		buttons[0].pressed = false;
		gamepad.axes[0] = 0;
		manager.update();
		buttons[0].pressed = true;
		manager.update();
		expect(manager.justPressed("CONFIRM")).toBe(true);

		manager.destroy();
	});

	it("routes keyboard input and suspends every device behind the settings dialog", () => {
		const { manager, keysByBinding } = createInputManager();
		const enter = keysByBinding.get("ENTER");
		if (!enter) throw new Error("Expected the default confirm key.");
		enter.justDown = true;

		manager.update();
		expect(manager.justPressed("CONFIRM")).toBe(true);

		const panel = document.createElement("section");
		panel.className = "game-settings-panel";
		document.body.append(panel);
		enter.isDown = true;
		dispatchVirtualGameInput("CONFIRM", true);

		manager.update();
		expect(manager.justPressed("CONFIRM")).toBe(false);
		expect(manager.isDown("CONFIRM")).toBe(false);

		dispatchVirtualGameInput("CONFIRM", false);
		manager.destroy();
	});
});
