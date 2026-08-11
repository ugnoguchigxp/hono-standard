import type { GameSession } from "@shared/game";
import Phaser from "phaser";
import type { GameAudioManager } from "./audio/GameAudioManager";
import type { GameContentLoader } from "./content/GameContentLoader";
import { GAME_CANVAS_HEIGHT, GAME_CANVAS_WIDTH } from "./display";
import type { GameRuntimeError } from "./runtime-errors";
import { BattleScene } from "./scenes/BattleScene";
import { BootScene } from "./scenes/BootScene";
import { EventScene } from "./scenes/EventScene";
import { FieldMenuScene } from "./scenes/FieldMenuScene";
import { FieldScene } from "./scenes/FieldScene";

export const GAME_WIDTH = GAME_CANVAS_WIDTH;
export const GAME_HEIGHT = GAME_CANVAS_HEIGHT;

export function createGameConfig(
	parent: HTMLElement,
	session: GameSession,
	contentLoader: GameContentLoader,
	onRuntimeError: (error: GameRuntimeError) => void,
	audioManager: GameAudioManager,
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
			new BootScene(session, onRuntimeError, audioManager),
			new FieldScene(session, contentLoader, onRuntimeError, audioManager),
			new FieldMenuScene(session, audioManager),
			new EventScene(session, audioManager),
			new BattleScene(session, audioManager),
		],
		scale: {
			mode: Phaser.Scale.FIT,
			autoCenter: Phaser.Scale.CENTER_BOTH,
		},
	};
}
