import Phaser from "phaser";
import type { GameSession } from "@shared/game";
import { createGameConfig } from "./config";
import type { GameRuntimeError } from "./runtime-errors";
import type { GameContentLoader } from "./content/GameContentLoader";
import { GameAudioManager } from "./audio/GameAudioManager";

export type PhaserGameInstance = Pick<Phaser.Game, "destroy">;

export function createPhaserGame(
	parent: HTMLElement,
	session: GameSession,
	contentLoader: GameContentLoader,
	onRuntimeError: (error: GameRuntimeError) => void,
): PhaserGameInstance {
	const audioManager = new GameAudioManager();
	const game = new Phaser.Game(
		createGameConfig(
			parent,
			session,
			contentLoader,
			onRuntimeError,
			audioManager,
		),
	);
	return {
		destroy(removeCanvas?: boolean) {
			audioManager.destroy();
			game.destroy(removeCanvas ?? false);
		},
	};
}
