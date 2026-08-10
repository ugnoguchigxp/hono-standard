import Phaser from "phaser";
import type { GameSession } from "@shared/game";
import { createPixelTextures } from "../art/pixel-textures";

export class BootScene extends Phaser.Scene {
	constructor(private readonly gameSession: GameSession) {
		super("boot");
	}

	preload(): void {
		this.load.image(
			"signal-ruins-field",
			"/assets/game/backgrounds/signal-ruins-field.png",
		);
		this.load.image(
			"signal-ruins-battle",
			"/assets/game/backgrounds/signal-ruins-battle.png",
		);
	}

	create(): void {
		createPixelTextures(this);
		const state = this.gameSession.snapshot();
		const targetScene =
			state.mode === "battle" && state.battle ? "battle" : state.mode;
		this.scene.start(targetScene);
	}
}
