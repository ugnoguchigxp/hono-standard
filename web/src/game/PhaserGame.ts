import Phaser from "phaser";
import type { GameContentRegistry, GameSession } from "@shared/game";
import { createGameConfig } from "./config";
import type { GameRuntimeError } from "./runtime-errors";

export type PhaserGameInstance = Pick<Phaser.Game, "destroy">;

export function createPhaserGame(
	parent: HTMLElement,
	session: GameSession,
	registry: GameContentRegistry,
	onRuntimeError: (error: GameRuntimeError) => void,
): PhaserGameInstance {
	return new Phaser.Game(
		createGameConfig(parent, session, registry, onRuntimeError),
	);
}
