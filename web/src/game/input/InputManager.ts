import Phaser from "phaser";
import {
	gameActions,
	type GameAction,
	type VirtualGameInputDetail,
	VIRTUAL_GAME_INPUT_EVENT,
} from "./game-actions";
import {
	gameSettingsStore,
	type GameSettingsStore,
} from "../settings/GameSettingsStore";

export { gameActions, type GameAction } from "./game-actions";

const gamepadButtons: Readonly<Partial<Record<GameAction, number>>> = {
	CONFIRM: 0,
	CANCEL: 1,
	PAUSE: 8,
	MENU: 9,
	UP: 12,
	DOWN: 13,
	LEFT: 14,
	RIGHT: 15,
};

export class InputManager {
	private keys!: Record<GameAction, Phaser.Input.Keyboard.Key[]>;
	private readonly framePressed = new Set<GameAction>();
	private readonly virtualDown = new Set<GameAction>();
	private readonly pendingVirtualPressed = new Set<GameAction>();
	private readonly previousGamepadDown = new Set<GameAction>();
	private keyBindingSignature = "";
	private suspended = false;
	private readonly removeSettingsSubscription: () => void;
	private readonly virtualInputListener: EventListener;
	private readonly blurListener: EventListener;

	constructor(
		private readonly scene: Phaser.Scene,
		private readonly settingsStore: GameSettingsStore = gameSettingsStore,
	) {
		const keyboard = scene.input.keyboard;
		if (!keyboard) {
			throw new Error("Keyboard input is unavailable.");
		}
		this.rebuildKeyboardBindings();
		this.removeSettingsSubscription = settingsStore.subscribe(() =>
			this.rebuildKeyboardBindings(),
		);
		this.virtualInputListener = ((
			event: CustomEvent<VirtualGameInputDetail>,
		) => {
			const { action, pressed } = event.detail;
			if (pressed) {
				if (!this.virtualDown.has(action))
					this.pendingVirtualPressed.add(action);
				this.virtualDown.add(action);
			} else {
				this.virtualDown.delete(action);
			}
		}) as EventListener;
		this.blurListener = (() => {
			this.virtualDown.clear();
			this.pendingVirtualPressed.clear();
			this.previousGamepadDown.clear();
		}) as EventListener;
		if (typeof window !== "undefined") {
			window.addEventListener(
				VIRTUAL_GAME_INPUT_EVENT,
				this.virtualInputListener,
			);
			window.addEventListener("blur", this.blurListener);
		}
	}

	update(): void {
		this.framePressed.clear();
		this.suspended =
			typeof document !== "undefined" &&
			document.querySelector(".game-settings-panel") !== null;
		if (this.suspended) {
			for (const action of gameActions) {
				for (const key of this.keys[action]) {
					Phaser.Input.Keyboard.JustDown(key);
				}
			}
			this.pendingVirtualPressed.clear();
			const gamepadDown = this.readGamepadActions();
			this.previousGamepadDown.clear();
			for (const action of gamepadDown) this.previousGamepadDown.add(action);
			return;
		}
		for (const action of gameActions) {
			if (
				this.keys[action].some((key) => Phaser.Input.Keyboard.JustDown(key))
			) {
				this.framePressed.add(action);
			}
		}
		for (const action of this.pendingVirtualPressed) {
			this.framePressed.add(action);
		}
		this.pendingVirtualPressed.clear();

		const gamepadDown = this.readGamepadActions();
		for (const action of gamepadDown) {
			if (!this.previousGamepadDown.has(action)) this.framePressed.add(action);
		}
		this.previousGamepadDown.clear();
		for (const action of gamepadDown) this.previousGamepadDown.add(action);
	}

	isDown(action: GameAction): boolean {
		if (this.suspended) return false;
		return (
			this.keys[action].some((key) => key.isDown) ||
			this.virtualDown.has(action) ||
			this.previousGamepadDown.has(action)
		);
	}

	justPressed(action: GameAction): boolean {
		return !this.suspended && this.framePressed.has(action);
	}

	destroy(): void {
		this.removeSettingsSubscription();
		if (typeof window !== "undefined") {
			window.removeEventListener(
				VIRTUAL_GAME_INPUT_EVENT,
				this.virtualInputListener,
			);
			window.removeEventListener("blur", this.blurListener);
		}
		this.destroyKeys();
	}

	private rebuildKeyboardBindings(): void {
		const keyboard = this.scene.input.keyboard;
		if (!keyboard) return;
		const bindings = this.settingsStore.getSnapshot().keyBindings;
		const signature = JSON.stringify(bindings);
		if (signature === this.keyBindingSignature) return;
		this.keyBindingSignature = signature;
		this.destroyKeys();
		this.keys = Object.fromEntries(
			gameActions.map((action) => [
				action,
				bindings[action].map((key) => keyboard.addKey(key)),
			]),
		) as Record<GameAction, Phaser.Input.Keyboard.Key[]>;
	}

	private destroyKeys(): void {
		if (!this.keys) return;
		for (const key of new Set(Object.values(this.keys).flat())) {
			key.destroy();
		}
	}

	private readGamepadActions(): Set<GameAction> {
		const down = new Set<GameAction>();
		if (
			!this.settingsStore.getSnapshot().gamepadEnabled ||
			typeof navigator === "undefined" ||
			typeof navigator.getGamepads !== "function"
		) {
			return down;
		}
		const gamepad = [...navigator.getGamepads()].find(
			(candidate): candidate is Gamepad => Boolean(candidate?.connected),
		);
		if (!gamepad) return down;
		for (const action of gameActions) {
			const buttonIndex = gamepadButtons[action];
			if (buttonIndex !== undefined && gamepad.buttons[buttonIndex]?.pressed) {
				down.add(action);
			}
		}
		const horizontal = gamepad.axes[0] ?? 0;
		const vertical = gamepad.axes[1] ?? 0;
		if (horizontal <= -0.5) down.add("LEFT");
		if (horizontal >= 0.5) down.add("RIGHT");
		if (vertical <= -0.5) down.add("UP");
		if (vertical >= 0.5) down.add("DOWN");
		return down;
	}
}
