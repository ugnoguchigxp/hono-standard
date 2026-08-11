import { describe, expect, it, vi } from "vitest";
import {
	createDefaultGameSettings,
	GAME_SETTINGS_STORAGE_KEY,
	GameSettingsStore,
	getTextCharacterDelay,
} from "./GameSettingsStore";

const memoryStorage = () => {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		values,
	};
};

describe("GameSettingsStore", () => {
	it("persists audio, display, and remapped input settings", () => {
		const storage = memoryStorage();
		const store = new GameSettingsStore(storage);
		const listener = vi.fn();
		store.subscribe(listener);

		store.update({ masterVolume: 0.35, screenScale: "2", reducedMotion: true });
		store.setKeyBinding("CONFIRM", "C");

		expect(listener).toHaveBeenCalledTimes(2);
		expect(store.getSnapshot()).toMatchObject({
			masterVolume: 0.35,
			screenScale: "2",
			reducedMotion: true,
		});
		expect(store.getSnapshot().keyBindings.CONFIRM).toEqual(["C"]);
		expect(new GameSettingsStore(storage).getSnapshot()).toEqual(
			store.getSnapshot(),
		);
	});

	it("falls back safely when persisted settings are corrupt", () => {
		const storage = memoryStorage();
		storage.values.set(GAME_SETTINGS_STORAGE_KEY, "not-json");
		expect(new GameSettingsStore(storage).getSnapshot()).toEqual(
			createDefaultGameSettings(),
		);
	});

	it("repairs every invalid persisted scalar and empty binding list", () => {
		const storage = memoryStorage();
		storage.values.set(
			GAME_SETTINGS_STORAGE_KEY,
			JSON.stringify({
				version: 1,
				masterVolume: Number.NaN,
				bgmVolume: -1,
				seVolume: 2,
				environmentVolume: "loud",
				muted: "yes",
				textSpeed: "unknown",
				reducedMotion: "yes",
				highContrast: "yes",
				screenScale: "4",
				touchControls: "sometimes",
				gamepadEnabled: "yes",
				keyBindings: { UP: [] },
			}),
		);

		expect(new GameSettingsStore(storage).getSnapshot()).toEqual(
			createDefaultGameSettings(),
		);
	});

	it("ignores an obsolete settings version", () => {
		const storage = memoryStorage();
		storage.values.set(
			GAME_SETTINGS_STORAGE_KEY,
			JSON.stringify({ version: 2 }),
		);
		expect(new GameSettingsStore(storage).getSnapshot()).toEqual(
			createDefaultGameSettings(),
		);
	});

	it("repairs unsupported and cross-action duplicate persisted bindings", () => {
		const storage = memoryStorage();
		const persisted = createDefaultGameSettings();
		persisted.keyBindings.CONFIRM = ["M"];
		persisted.keyBindings.MENU = ["M"];
		persisted.keyBindings.PAUSE = ["F1"];
		storage.values.set(GAME_SETTINGS_STORAGE_KEY, JSON.stringify(persisted));

		const { keyBindings } = new GameSettingsStore(storage).getSnapshot();
		const flattened = Object.values(keyBindings).flat();
		expect(flattened).not.toContain("F1");
		expect(new Set(flattened).size).toBe(flattened.length);
		expect(Object.values(keyBindings).every(({ length }) => length > 0)).toBe(
			true,
		);
	});

	it("moves a key binding instead of leaving two actions on the same key", () => {
		const store = new GameSettingsStore(memoryStorage());

		store.setKeyBinding("CONFIRM", "M");

		const { keyBindings } = store.getSnapshot();
		expect(keyBindings.CONFIRM).toEqual(["M"]);
		expect(keyBindings.MENU).toEqual(["ENTER"]);
		expect(new Set(Object.values(keyBindings).flat()).size).toBe(
			Object.values(keyBindings).flat().length,
		);
	});

	it("ignores unsupported or already assigned bindings and unsubscribes", () => {
		const store = new GameSettingsStore(memoryStorage());
		const listener = vi.fn();
		const unsubscribe = store.subscribe(listener);

		store.setKeyBinding("CONFIRM", "F1");
		store.setKeyBinding("CONFIRM", "ENTER");
		unsubscribe();
		store.update({ muted: true });

		expect(listener).not.toHaveBeenCalled();
		expect(store.getSnapshot().keyBindings.CONFIRM).toEqual([
			"ENTER",
			"SPACE",
			"Z",
		]);
	});

	it("keeps runtime settings when storage read or write throws", () => {
		const store = new GameSettingsStore({
			getItem: () => {
				throw new Error("read disabled");
			},
			setItem: () => {
				throw new Error("write disabled");
			},
		});

		store.update({ muted: true });
		expect(store.getSnapshot().muted).toBe(true);
	});

	it("maps every dialogue speed to a deterministic delay", () => {
		expect(getTextCharacterDelay("slow")).toBeGreaterThan(
			getTextCharacterDelay("normal"),
		);
		expect(getTextCharacterDelay("normal")).toBeGreaterThan(
			getTextCharacterDelay("fast"),
		);
		expect(getTextCharacterDelay("instant")).toBe(0);
	});
});
