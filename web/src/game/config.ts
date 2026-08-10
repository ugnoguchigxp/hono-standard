import Phaser from "phaser";
import type { GameSession } from "@shared/game";
import { BootScene } from "./scenes/BootScene";
import { BattleScene } from "./scenes/BattleScene";
import { EventScene } from "./scenes/EventScene";
import { FieldScene } from "./scenes/FieldScene";

export const GAME_WIDTH = 320;
export const GAME_HEIGHT = 192;

export function createGameConfig(
	parent: HTMLElement,
	session: GameSession,
): Phaser.Types.Core.GameConfig {
	return {
		type: Phaser.CANVAS,
		parent,
		width: GAME_WIDTH,
		height: GAME_HEIGHT,
		backgroundColor: "#101528",
		pixelArt: true,
		antialias: false,
		scene: [
			new BootScene(session),
			new FieldScene(session),
			new EventScene(session),
			new BattleScene(session),
		],
		scale: {
			mode: Phaser.Scale.FIT,
			autoCenter: Phaser.Scale.CENTER_BOTH,
		},
	};
}
