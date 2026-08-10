import Phaser from "phaser";
import type { GameSession } from "@shared/game";
import { createGameConfig } from "./config";

export type PhaserGameInstance = Pick<Phaser.Game, "destroy">;

export function createPhaserGame(
	parent: HTMLElement,
	session: GameSession,
): PhaserGameInstance {
	return new Phaser.Game(createGameConfig(parent, session));
}
