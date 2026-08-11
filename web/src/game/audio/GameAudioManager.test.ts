// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { GameSettingsStore } from "../settings/GameSettingsStore";
import { GameAudioManager } from "./GameAudioManager";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("GameAudioManager", () => {
	it("handles pre-attach calls, blocked playback, locked audio, and no-frame fades", () => {
		const settings = new GameSettingsStore();
		const audio = new GameAudioManager(settings);
		expect(audio.playSe("se-ui-confirm")).toBe(false);
		audio.playBgm("bgm-field-signal-ruins");
		expect(() => audio.playBgm("se-ui-confirm")).toThrow("not a BGM cue");

		const makeSound = () => ({
			volume: 0.5,
			seek: Number.NaN,
			once: vi.fn(),
			play: vi.fn(() => false),
			stop: vi.fn(),
			destroy: vi.fn(),
			setVolume: vi.fn(function (this: { volume: number }, value: number) {
				this.volume = value;
				return this;
			}),
		});
		const first = makeSound();
		const second = makeSound();
		const sounds = [first, second];
		const soundManager = {
			locked: true,
			mute: false,
			volume: 1,
			once: vi.fn(),
			off: vi.fn(),
			add: vi.fn(() => sounds.shift()),
			play: vi.fn(() => true),
		};
		const canvas = document.createElement("canvas");
		audio.attach(soundManager as never, canvas);
		expect(canvas.dataset.audioState).toBe("locked");

		audio.playBgm("bgm-field-signal-ruins");
		expect(canvas.dataset.audioPlayback).toBe("blocked");
		expect(audio.playSe("bgm-field-signal-ruins")).toBe(false);
		expect(audio.playSe("se-field-recovery")).toBe(true);
		audio.playBgm("bgm-field-signal-ruins");

		vi.stubGlobal("requestAnimationFrame", undefined);
		audio.playBgm("bgm-battle-standard");
		expect(first.stop).toHaveBeenCalledOnce();
		expect(first.destroy).toHaveBeenCalledOnce();
		expect(second.setVolume).toHaveBeenCalled();
		audio.destroy();
	});

	it("mixes BGM and effects through persisted bus settings", () => {
		const settings = new GameSettingsStore();
		settings.update({ reducedMotion: true });
		const sound = {
			volume: 0,
			seek: 0,
			once: vi.fn(),
			play: vi.fn(() => true),
			stop: vi.fn(),
			destroy: vi.fn(),
			setVolume: vi.fn(function (this: { volume: number }, value: number) {
				this.volume = value;
				return this;
			}),
		};
		const soundManager = {
			locked: false,
			mute: false,
			volume: 1,
			once: vi.fn(),
			off: vi.fn(),
			add: vi.fn(() => sound),
			play: vi.fn(() => true),
		};
		const canvas = document.createElement("canvas");
		const audio = new GameAudioManager(settings);

		audio.attach(soundManager as never, canvas);
		audio.playBgm("bgm-field-signal-ruins");
		expect(soundManager.add).toHaveBeenCalledWith(
			"bgm-field-signal-ruins",
			expect.objectContaining({ loop: true }),
		);
		expect(sound.play).toHaveBeenCalledWith(
			expect.objectContaining({ loop: true, seek: 0 }),
		);
		expect(canvas.dataset.audioTrack).toBe("bgm-field-signal-ruins");
		expect(canvas.dataset.audioPlayback).toBe("playing");

		audio.playSe("se-ui-confirm");
		expect(soundManager.play).toHaveBeenCalledWith(
			"se-ui-confirm",
			expect.objectContaining({ loop: false }),
		);

		settings.update({ masterVolume: 0.25, muted: true });
		expect(soundManager.volume).toBe(0.25);
		expect(soundManager.mute).toBe(true);
		expect(canvas.dataset.audioMuted).toBe("true");

		audio.destroy();
		expect(soundManager.off).toHaveBeenCalledWith(
			"unlocked",
			expect.any(Function),
		);
		expect(sound.stop).toHaveBeenCalledOnce();
		expect(sound.destroy).toHaveBeenCalledOnce();
	});

	it("cleans up an interrupted crossfade and uses the latest music volume", () => {
		let nextFrameId = 1;
		const frames = new Map<number, FrameRequestCallback>();
		vi.stubGlobal(
			"requestAnimationFrame",
			vi.fn((callback: FrameRequestCallback) => {
				const id = nextFrameId++;
				frames.set(id, callback);
				return id;
			}),
		);
		vi.stubGlobal(
			"cancelAnimationFrame",
			vi.fn((id: number) => frames.delete(id)),
		);

		const makeSound = () => ({
			volume: 0,
			seek: 0,
			once: vi.fn(),
			play: vi.fn(() => true),
			stop: vi.fn(),
			destroy: vi.fn(),
			setVolume: vi.fn(function (this: { volume: number }, value: number) {
				this.volume = value;
				return this;
			}),
		});
		const field = makeSound();
		const battle = makeSound();
		const boss = makeSound();
		const sounds = [field, battle, boss];
		const soundManager = {
			locked: false,
			mute: false,
			volume: 1,
			once: vi.fn(),
			off: vi.fn(),
			add: vi.fn(() => {
				const sound = sounds.shift();
				if (!sound) throw new Error("Unexpected sound allocation.");
				return sound;
			}),
			play: vi.fn(() => true),
		};
		const settings = new GameSettingsStore();
		const audio = new GameAudioManager(settings);
		audio.attach(soundManager as never, document.createElement("canvas"));

		audio.playBgm("bgm-field-signal-ruins");
		audio.playBgm("bgm-battle-standard");
		audio.playBgm("bgm-battle-boss");

		expect(field.stop).toHaveBeenCalledOnce();
		expect(field.destroy).toHaveBeenCalledOnce();
		expect(cancelAnimationFrame).toHaveBeenCalledOnce();

		settings.update({ bgmVolume: 0.2 });
		const pendingFrame = [...frames.values()].at(-1);
		if (!pendingFrame) throw new Error("Expected a pending crossfade frame.");
		pendingFrame(performance.now() + 500);

		expect(battle.stop).toHaveBeenCalledOnce();
		expect(battle.destroy).toHaveBeenCalledOnce();
		expect(boss.volume).toBeCloseTo(0.2 * 0.82);

		audio.destroy();
		expect(boss.stop).toHaveBeenCalledOnce();
		expect(boss.destroy).toHaveBeenCalledOnce();
	});
});
