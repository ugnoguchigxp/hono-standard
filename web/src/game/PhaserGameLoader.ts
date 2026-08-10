import type { createPhaserGame } from "./PhaserGame";

export async function loadPhaserGameFactory(): Promise<
	typeof createPhaserGame
> {
	const gameModule = await import("./PhaserGame");
	return gameModule.createPhaserGame;
}
