import type { GameSession } from "@shared/game";
import Phaser from "phaser";
import { GameAudioManager } from "./audio/GameAudioManager";
import { createGameConfig } from "./config";
import type { GameContentLoader } from "./content/GameContentLoader";
import type { GameRuntimeError } from "./runtime-errors";

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
