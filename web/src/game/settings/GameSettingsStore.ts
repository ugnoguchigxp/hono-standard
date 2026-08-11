import { useSyncExternalStore } from "react";
import {
	type GameAction,
	gameActions,
	isSupportedKeyboardBinding,
	supportedKeyboardBindings,
} from "../input/game-actions";

export type GameTextSpeed = "slow" | "normal" | "fast" | "instant";
export type GameScreenScale = "fit" | "1" | "2" | "3";
export type TouchControlMode = "auto" | "on" | "off";

export interface GameSettings {
	version: 1;
	masterVolume: number;
	bgmVolume: number;
	seVolume: number;
	environmentVolume: number;
	muted: boolean;
	textSpeed: GameTextSpeed;
	reducedMotion: boolean;
	highContrast: boolean;
	screenScale: GameScreenScale;
	touchControls: TouchControlMode;
	gamepadEnabled: boolean;
	keyBindings: Record<GameAction, string[]>;
}

export const GAME_SETTINGS_STORAGE_KEY = "echoes-at-dawn:settings:v1";

export const defaultKeyBindings: Readonly<
	Record<GameAction, readonly string[]>
> = {
	UP: ["UP", "W"],
	DOWN: ["DOWN", "S"],
	LEFT: ["LEFT", "A"],
	RIGHT: ["RIGHT", "D"],
	CONFIRM: ["ENTER", "SPACE", "Z"],
	CANCEL: ["ESC", "X"],
	MENU: ["M"],
	PAUSE: ["P"],
};

const cloneDefaultBindings = (): Record<GameAction, string[]> =>
	Object.fromEntries(
		gameActions.map((action) => [action, [...defaultKeyBindings[action]]]),
	) as Record<GameAction, string[]>;

export const createDefaultGameSettings = (): GameSettings => ({
	version: 1,
	masterVolume: 0.8,
	bgmVolume: 0.62,
	seVolume: 0.8,
	environmentVolume: 0.55,
	muted: false,
	textSpeed: "instant",
	reducedMotion: false,
	highContrast: false,
	screenScale: "fit",
	touchControls: "auto",
	gamepadEnabled: true,
	keyBindings: cloneDefaultBindings(),
});

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const isNumberInRange = (value: unknown): value is number =>
	typeof value === "number" &&
	Number.isFinite(value) &&
	value >= 0 &&
	value <= 1;

const parseSettings = (raw: string | null): GameSettings | null => {
	if (!raw) return null;
	try {
		const candidate = JSON.parse(raw) as Partial<GameSettings>;
		if (candidate.version !== 1) return null;
		const defaults = createDefaultGameSettings();
		const textSpeed = ["slow", "normal", "fast", "instant"].includes(
			String(candidate.textSpeed),
		)
			? (candidate.textSpeed as GameTextSpeed)
			: defaults.textSpeed;
		const screenScale = ["fit", "1", "2", "3"].includes(
			String(candidate.screenScale),
		)
			? (candidate.screenScale as GameScreenScale)
			: defaults.screenScale;
		const touchControls = ["auto", "on", "off"].includes(
			String(candidate.touchControls),
		)
			? (candidate.touchControls as TouchControlMode)
			: defaults.touchControls;
		const keyBindings = cloneDefaultBindings();
		for (const action of gameActions) {
			const bindings = candidate.keyBindings?.[action];
			if (
				Array.isArray(bindings) &&
				bindings.length > 0 &&
				bindings.every(isSupportedKeyboardBinding)
			) {
				keyBindings[action] = [...new Set(bindings)].slice(0, 3);
			}
		}
		const claimedBindings = new Set<string>();
		for (const action of gameActions) {
			const uniqueBindings = keyBindings[action].filter(
				(binding) => !claimedBindings.has(binding),
			);
			if (uniqueBindings.length === 0) {
				const fallback = [
					...defaultKeyBindings[action],
					...supportedKeyboardBindings,
				].find((binding) => !claimedBindings.has(binding));
				if (fallback) uniqueBindings.push(fallback);
			}
			keyBindings[action] = uniqueBindings;
			for (const binding of uniqueBindings) claimedBindings.add(binding);
		}
		return {
			version: 1,
			masterVolume: isNumberInRange(candidate.masterVolume)
				? candidate.masterVolume
				: defaults.masterVolume,
			bgmVolume: isNumberInRange(candidate.bgmVolume)
				? candidate.bgmVolume
				: defaults.bgmVolume,
			seVolume: isNumberInRange(candidate.seVolume)
				? candidate.seVolume
				: defaults.seVolume,
			environmentVolume: isNumberInRange(candidate.environmentVolume)
				? candidate.environmentVolume
				: defaults.environmentVolume,
			muted:
				typeof candidate.muted === "boolean" ? candidate.muted : defaults.muted,
			textSpeed,
			reducedMotion:
				typeof candidate.reducedMotion === "boolean"
					? candidate.reducedMotion
					: defaults.reducedMotion,
			highContrast:
				typeof candidate.highContrast === "boolean"
					? candidate.highContrast
					: defaults.highContrast,
			screenScale,
			touchControls,
			gamepadEnabled:
				typeof candidate.gamepadEnabled === "boolean"
					? candidate.gamepadEnabled
					: defaults.gamepadEnabled,
			keyBindings,
		};
	} catch {
		return null;
	}
};

export class GameSettingsStore {
	private settings: GameSettings;
	private readonly listeners = new Set<() => void>();

	constructor(private readonly storage?: StorageLike) {
		let stored: string | null = null;
		try {
			stored = storage?.getItem(GAME_SETTINGS_STORAGE_KEY) ?? null;
		} catch {
			// Storage can be unavailable in privacy modes; defaults remain usable.
		}
		this.settings = parseSettings(stored) ?? createDefaultGameSettings();
	}

	getSnapshot = (): GameSettings => this.settings;

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	update(patch: Partial<Omit<GameSettings, "version" | "keyBindings">>): void {
		this.commit({ ...this.settings, ...patch, version: 1 });
	}

	setKeyBinding(action: GameAction, binding: string): void {
		if (!isSupportedKeyboardBinding(binding)) return;
		if (this.settings.keyBindings[action].includes(binding)) return;
		const previousPrimary = this.settings.keyBindings[action][0];
		const keyBindings = Object.fromEntries(
			gameActions.map((candidate) => [
				candidate,
				[...this.settings.keyBindings[candidate]],
			]),
		) as Record<GameAction, string[]>;
		for (const candidate of gameActions) {
			if (candidate === action) continue;
			const withoutConflict = keyBindings[candidate].filter(
				(candidateBinding) => candidateBinding !== binding,
			);
			if (withoutConflict.length === 0) {
				const replacement =
					(previousPrimary !== binding ? previousPrimary : undefined) ??
					defaultKeyBindings[candidate].find(
						(candidateBinding) => candidateBinding !== binding,
					);
				if (replacement) withoutConflict.push(replacement);
			}
			keyBindings[candidate] = withoutConflict;
		}
		keyBindings[action] = [binding];
		this.commit({
			...this.settings,
			keyBindings,
		});
	}

	reset(): void {
		this.commit(createDefaultGameSettings());
	}

	private commit(next: GameSettings): void {
		this.settings = next;
		try {
			this.storage?.setItem(GAME_SETTINGS_STORAGE_KEY, JSON.stringify(next));
		} catch {
			// Runtime settings still work when persistence is unavailable.
		}
		for (const listener of this.listeners) listener();
	}
}

const browserStorage = (): StorageLike | undefined => {
	try {
		return typeof window === "undefined" ? undefined : window.localStorage;
	} catch {
		return undefined;
	}
};

export const gameSettingsStore = new GameSettingsStore(browserStorage());

export const useGameSettings = (): GameSettings =>
	useSyncExternalStore(
		gameSettingsStore.subscribe,
		gameSettingsStore.getSnapshot,
		gameSettingsStore.getSnapshot,
	);

export const getTextCharacterDelay = (speed: GameTextSpeed): number => {
	switch (speed) {
		case "slow":
			return 55;
		case "normal":
			return 32;
		case "fast":
			return 15;
		case "instant":
			return 0;
	}
};
