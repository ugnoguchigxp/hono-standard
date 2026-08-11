import type Phaser from "phaser";
import {
	type GameSettings,
	type GameSettingsStore,
	gameSettingsStore,
} from "../settings/GameSettingsStore";
import {
	type GameAudioBus,
	type GameAudioDefinition,
	type GameAudioId,
	gameAudioById,
} from "./audio-catalog";

type AdjustableSound = Phaser.Sound.BaseSound & {
	volume: number;
	seek: number;
	setVolume(value: number): AdjustableSound;
};

const clampVolume = (value: number): number => Math.max(0, Math.min(1, value));

export class GameAudioManager {
	private soundManager?: Phaser.Sound.BaseSoundManager;
	private canvas?: HTMLCanvasElement;
	private currentBgm?: AdjustableSound;
	private currentBgmId?: GameAudioId;
	private fadingOutSound?: AdjustableSound;
	private fadeFrame?: number;
	private readonly resumePositions = new Map<GameAudioId, number>();
	private readonly removeSettingsSubscription: () => void;
	private readonly handleUnlocked = () => this.updateAudioStatus();

	constructor(
		private readonly settingsStore: GameSettingsStore = gameSettingsStore,
	) {
		this.removeSettingsSubscription = settingsStore.subscribe(() =>
			this.applySettings(),
		);
	}

	attach(
		soundManager: Phaser.Sound.BaseSoundManager,
		canvas: HTMLCanvasElement,
	): void {
		this.soundManager = soundManager;
		this.canvas = canvas;
		this.applySettings();
		this.updateAudioStatus();
		soundManager.once("unlocked", this.handleUnlocked);
	}

	playBgm(id: GameAudioId): void {
		const definition = gameAudioById[id];
		if (definition.bus !== "bgm") {
			throw new Error(`Audio '${id}' is not a BGM cue.`);
		}
		if (!this.soundManager || this.currentBgmId === id) return;
		if (
			this.fadeFrame !== undefined &&
			typeof cancelAnimationFrame === "function"
		) {
			cancelAnimationFrame(this.fadeFrame);
			this.fadeFrame = undefined;
			this.fadingOutSound?.stop();
			this.fadingOutSound?.destroy();
			this.fadingOutSound = undefined;
		}

		const previous = this.currentBgm;
		const previousId = this.currentBgmId;
		if (previous && previousId && Number.isFinite(previous.seek)) {
			this.resumePositions.set(previousId, previous.seek);
		}
		const targetVolume = this.volumeFor(definition);
		const next = this.soundManager.add(id, {
			loop: true,
			volume: previous ? 0 : targetVolume,
		}) as AdjustableSound;
		next.once("play", () => {
			if (this.canvas) this.canvas.dataset.audioPlayback = "playing";
		});
		const started = next.play({
			loop: true,
			volume: previous ? 0 : targetVolume,
			seek: this.resumePositions.get(id) ?? 0,
		});
		if (this.canvas) {
			this.canvas.dataset.audioPlayback = started ? "playing" : "blocked";
		}
		this.currentBgm = next;
		this.currentBgmId = id;
		this.updateAudioStatus();

		if (!previous || this.settingsStore.getSnapshot().reducedMotion) {
			previous?.stop();
			previous?.destroy();
			next.setVolume(targetVolume);
			return;
		}
		this.crossfade(previous, next, definition);
	}

	playSe(id: GameAudioId): boolean {
		const definition = gameAudioById[id];
		if (!this.soundManager || definition.bus === "bgm") return false;
		return this.soundManager.play(id, {
			loop: definition.loop,
			volume: this.volumeFor(definition),
		});
	}

	destroy(): void {
		this.removeSettingsSubscription();
		this.soundManager?.off("unlocked", this.handleUnlocked);
		if (
			this.fadeFrame !== undefined &&
			typeof cancelAnimationFrame === "function"
		) {
			cancelAnimationFrame(this.fadeFrame);
		}
		this.currentBgm?.stop();
		this.currentBgm?.destroy();
		this.fadingOutSound?.stop();
		this.fadingOutSound?.destroy();
		this.currentBgm = undefined;
		this.fadingOutSound = undefined;
		this.soundManager = undefined;
		this.canvas = undefined;
	}

	private volumeFor(definition: GameAudioDefinition): number {
		const settings = this.settingsStore.getSnapshot();
		const busVolume = this.busVolume(definition.bus, settings);
		return clampVolume(busVolume * definition.volume);
	}

	private busVolume(bus: GameAudioBus, settings: GameSettings): number {
		if (bus === "bgm") return settings.bgmVolume;
		if (bus === "environment") return settings.environmentVolume;
		return settings.seVolume;
	}

	private applySettings(): void {
		if (!this.soundManager) return;
		const settings = this.settingsStore.getSnapshot();
		this.soundManager.mute = settings.muted;
		this.soundManager.volume = settings.masterVolume;
		if (this.currentBgmId && this.currentBgm) {
			this.currentBgm.setVolume(
				this.volumeFor(gameAudioById[this.currentBgmId]),
			);
		}
		this.updateAudioStatus();
	}

	private crossfade(
		previous: AdjustableSound,
		next: AdjustableSound,
		definition: GameAudioDefinition,
	): void {
		const targetVolume = this.volumeFor(definition);
		if (typeof requestAnimationFrame !== "function") {
			previous.stop();
			previous.destroy();
			next.setVolume(targetVolume);
			return;
		}
		const startedAt = performance.now();
		const previousVolume = previous.volume;
		this.fadingOutSound = previous;
		const step = (time: number) => {
			const progress = Math.min(1, (time - startedAt) / 420);
			const liveTargetVolume = this.volumeFor(definition);
			previous.setVolume(previousVolume * (1 - progress));
			next.setVolume(liveTargetVolume * progress);
			if (progress < 1) {
				this.fadeFrame = requestAnimationFrame(step);
				return;
			}
			previous.stop();
			previous.destroy();
			this.fadingOutSound = undefined;
			this.fadeFrame = undefined;
		};
		this.fadeFrame = requestAnimationFrame(step);
	}

	private updateAudioStatus(): void {
		if (!this.canvas || !this.soundManager) return;
		this.canvas.dataset.audioState = this.soundManager.locked
			? "locked"
			: "ready";
		this.canvas.dataset.audioTrack = this.currentBgmId ?? "none";
		this.canvas.dataset.audioMuted = String(
			this.settingsStore.getSnapshot().muted,
		);
	}
}
