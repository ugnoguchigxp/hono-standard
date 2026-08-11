import type { GameSession } from "@shared/game";
import Phaser from "phaser";
import { createPixelTextures } from "../art/pixel-textures";
import { gameAudioCatalog } from "../audio/audio-catalog";
import type { GameAudioManager } from "../audio/GameAudioManager";
import { getRequiredAssetsForState } from "../content/content-assets";
import type { GameRuntimeError } from "../runtime-errors";
import { createGameUiBitmapFont } from "../ui/bitmap-font";

export class BootScene extends Phaser.Scene {
	private assetLoadFailed = false;
	private requiredAssetIds: string[] = [];
	private readonly requiredAudioIds = gameAudioCatalog.map(({ id }) => id);

	constructor(
		private readonly gameSession: GameSession,
		private readonly onRuntimeError: (error: GameRuntimeError) => void,
		private readonly audioManager: GameAudioManager,
	) {
		super("boot");
	}

	preload(): void {
		this.assetLoadFailed = false;
		const requiredAssets = getRequiredAssetsForState(
			this.gameSession.content,
			this.gameSession.snapshot(),
		);
		this.requiredAssetIds = requiredAssets.map(({ id }) => id);
		this.load.once("loaderror", (file: { key: string }) => {
			this.reportMissingAsset(file.key);
		});
		for (const asset of requiredAssets) {
			this.load.image(asset.id, asset.url);
		}
		for (const audio of gameAudioCatalog) {
			this.load.audio(audio.id, [...audio.urls]);
		}
	}

	create(): void {
		if (this.assetLoadFailed) return;
		const missingAssetId = this.requiredAssetIds.find(
			(assetId) => !this.textures.exists(assetId),
		);
		if (missingAssetId) {
			this.reportMissingAsset(missingAssetId);
			return;
		}
		const missingAudioId = this.requiredAudioIds.find(
			(audioId) => !this.cache.audio.exists(audioId),
		);
		if (missingAudioId) {
			this.reportMissingAsset(missingAudioId);
			return;
		}
		this.audioManager.attach(this.sound, this.game.canvas);
		createPixelTextures(this);
		createGameUiBitmapFont(this);
		const state = this.gameSession.snapshot();
		const targetScene =
			state.mode === "battle" && state.battle ? "battle" : state.mode;
		this.scene.start(targetScene);
	}

	private reportMissingAsset(assetId: string): void {
		if (this.assetLoadFailed) return;
		this.assetLoadFailed = true;
		console.error(`Game asset failed to load: ${assetId}`);
		this.onRuntimeError({
			code: "asset",
			assetId,
			retryable: true,
			message: `A required game asset (${assetId}) could not be loaded.`,
		});
	}
}
