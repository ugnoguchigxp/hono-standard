import Phaser from "phaser";
import type { GameContentRegistry, GameSession } from "@shared/game";
import { BootScene } from "./scenes/BootScene";
import { BattleScene } from "./scenes/BattleScene";
import { EventScene } from "./scenes/EventScene";
import { FieldMenuScene } from "./scenes/FieldMenuScene";
import { FieldScene } from "./scenes/FieldScene";
import type { GameRuntimeError } from "./runtime-errors";
import { GAME_CANVAS_HEIGHT, GAME_CANVAS_WIDTH } from "./display";

export const GAME_WIDTH = GAME_CANVAS_WIDTH;
export const GAME_HEIGHT = GAME_CANVAS_HEIGHT;

export function createGameConfig(
	parent: HTMLElement,
	session: GameSession,
	registry: GameContentRegistry,
	onRuntimeError: (error: GameRuntimeError) => void,
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
			new BootScene(session, registry, onRuntimeError),
			new FieldScene(session),
			new FieldMenuScene(session),
			new EventScene(session),
			new BattleScene(session),
		],
		scale: {
			mode: Phaser.Scale.FIT,
			autoCenter: Phaser.Scale.CENTER_BOTH,
		},
	};
}
