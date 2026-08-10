import Phaser from "phaser";

export const gameActions = [
	"UP",
	"DOWN",
	"LEFT",
	"RIGHT",
	"CONFIRM",
	"CANCEL",
	"MENU",
	"PAUSE",
] as const;

export type GameAction = (typeof gameActions)[number];

const keyBindings: Record<GameAction, string[]> = {
	UP: ["UP", "W"],
	DOWN: ["DOWN", "S"],
	LEFT: ["LEFT", "A"],
	RIGHT: ["RIGHT", "D"],
	CONFIRM: ["ENTER", "SPACE", "Z"],
	CANCEL: ["ESC", "X"],
	MENU: ["M"],
	PAUSE: ["P"],
};

export class InputManager {
	private readonly keys: Record<GameAction, Phaser.Input.Keyboard.Key[]>;

	constructor(scene: Phaser.Scene) {
		const keyboard = scene.input.keyboard;
		if (!keyboard) {
			throw new Error("Keyboard input is unavailable.");
		}
		this.keys = Object.fromEntries(
			gameActions.map((action) => [
				action,
				keyBindings[action].map((key) => keyboard.addKey(key)),
			]),
		) as Record<GameAction, Phaser.Input.Keyboard.Key[]>;
	}

	isDown(action: GameAction): boolean {
		return this.keys[action].some((key) => key.isDown);
	}

	justPressed(action: GameAction): boolean {
		return this.keys[action].some((key) => Phaser.Input.Keyboard.JustDown(key));
	}

	destroy(): void {
		for (const key of Object.values(this.keys).flat()) {
			key.destroy();
		}
	}
}
