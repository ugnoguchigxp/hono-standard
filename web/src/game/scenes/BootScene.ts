import type { GameContentRegistry, GameSession } from "@shared/game";
import Phaser from "phaser";
import { createPixelTextures } from "../art/pixel-textures";
import type { GameRuntimeError } from "../runtime-errors";

export class BootScene extends Phaser.Scene {
	private assetLoadFailed = false;

	constructor(
		private readonly gameSession: GameSession,
		private readonly contentRegistry: GameContentRegistry,
		private readonly onRuntimeError: (error: GameRuntimeError) => void,
	) {
		super("boot");
	}

	preload(): void {
		this.assetLoadFailed = false;
		this.load.once("loaderror", (file: { key: string }) => {
			this.assetLoadFailed = true;
			console.error(`Game asset failed to load: ${file.key}`);
			this.onRuntimeError({
				code: "asset",
				assetId: file.key,
				retryable: true,
				message: `A required world image (${file.key}) could not be loaded.`,
			});
		});
		for (const asset of this.contentRegistry.assets) {
			this.load.image(asset.id, asset.url);
		}
	}

	create(): void {
		if (this.assetLoadFailed) return;
		createPixelTextures(this);
		const state = this.gameSession.snapshot();
		const targetScene =
			state.mode === "battle" && state.battle ? "battle" : state.mode;
		this.scene.start(targetScene);
	}
}
