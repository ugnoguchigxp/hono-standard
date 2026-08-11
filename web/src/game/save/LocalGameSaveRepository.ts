import {
	createGameSave,
	decodeGameSave,
	type GameSaveDecodeResult,
	type GameSaveEnvelope,
	type GameState,
} from "@shared/game";
import { GAME_IDS } from "@shared/game-platform";

export type GameSaveStorage = Pick<
	Storage,
	"getItem" | "setItem" | "removeItem"
>;

export type LocalGameSaveLoadResult =
	| { status: "empty" }
	| { status: "error"; message: string }
	| GameSaveDecodeResult;

export type LocalGameSaveWriteResult =
	| { ok: true; save: GameSaveEnvelope }
	| { ok: false; message: string };

export const gameSaveStorageKey = (playerId: string): string => {
	const normalized = playerId.trim().toLowerCase();
	if (!normalized) throw new Error("Player ID must not be empty.");
	return `${GAME_IDS.rpg2d}:autosave:${encodeURIComponent(normalized)}`;
};

export class LocalGameSaveRepository {
	private readonly key: string;

	constructor(
		private readonly storage: GameSaveStorage,
		playerId: string,
	) {
		this.key = gameSaveStorageKey(playerId);
	}

	load(): LocalGameSaveLoadResult {
		try {
			const serialized = this.storage.getItem(this.key);
			return serialized === null
				? { status: "empty" }
				: decodeGameSave(serialized);
		} catch {
			return { status: "error", message: "Browser storage is unavailable." };
		}
	}

	save(state: GameState, savedAt?: string): LocalGameSaveWriteResult {
		try {
			const save = createGameSave(state, savedAt);
			this.storage.setItem(this.key, JSON.stringify(save));
			return { ok: true, save };
		} catch {
			return { ok: false, message: "Could not write the local autosave." };
		}
	}

	clear(): boolean {
		try {
			this.storage.removeItem(this.key);
			return true;
		} catch {
			return false;
		}
	}
}
