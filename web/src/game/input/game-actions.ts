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

export const gameActionLabels: Readonly<Record<GameAction, string>> = {
	UP: "Move up",
	DOWN: "Move down",
	LEFT: "Move left",
	RIGHT: "Move right",
	CONFIRM: "Confirm",
	CANCEL: "Cancel",
	MENU: "Menu",
	PAUSE: "Pause",
};

const namedKeyboardBindings = [
	"UP",
	"DOWN",
	"LEFT",
	"RIGHT",
	"ESC",
	"ENTER",
	"SPACE",
] as const;

export const supportedKeyboardBindings = [
	...namedKeyboardBindings,
	..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
] as const;

const supportedKeyboardBindingSet = new Set<string>(supportedKeyboardBindings);

export const isSupportedKeyboardBinding = (value: unknown): value is string =>
	typeof value === "string" && supportedKeyboardBindingSet.has(value);

export const normalizeKeyboardBinding = (key: string): string | null => {
	const aliases: Record<string, string> = {
		ArrowUp: "UP",
		ArrowDown: "DOWN",
		ArrowLeft: "LEFT",
		ArrowRight: "RIGHT",
		Escape: "ESC",
		Enter: "ENTER",
		" ": "SPACE",
	};
	if (aliases[key]) return aliases[key];
	if (/^[a-z0-9]$/i.test(key)) return key.toUpperCase();
	return null;
};

export const VIRTUAL_GAME_INPUT_EVENT = "echoes-at-dawn:virtual-input";

export interface VirtualGameInputDetail {
	action: GameAction;
	pressed: boolean;
}

export const dispatchVirtualGameInput = (
	action: GameAction,
	pressed: boolean,
): void => {
	if (typeof window === "undefined") return;
	window.dispatchEvent(
		new CustomEvent<VirtualGameInputDetail>(VIRTUAL_GAME_INPUT_EVENT, {
			detail: { action, pressed },
		}),
	);
};
