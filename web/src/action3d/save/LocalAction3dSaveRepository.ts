import {
	type Action3dSaveDecodeResult,
	type Action3dSaveEnvelope,
	type Action3dState,
	createAction3dSave,
	decodeAction3dSave,
} from "@shared/action3d";
import { GAME_IDS } from "@shared/game-platform";

export type Action3dSaveStorage = Pick<
	Storage,
	"getItem" | "setItem" | "removeItem"
>;
export type LocalAction3dLoadResult =
	| { status: "empty" }
	| { status: "error"; message: string }
	| Action3dSaveDecodeResult;
export type LocalAction3dWriteResult =
	| { ok: true; save: Action3dSaveEnvelope }
	| { ok: false; message: string };
export const action3dSaveStorageKey = (playerId: string): string => {
	const normalized = playerId.trim().toLowerCase();
	if (!normalized) throw new Error("Player ID must not be empty.");
	return `${GAME_IDS.action3d}:checkpoint:${encodeURIComponent(normalized)}`;
};
export class LocalAction3dSaveRepository {
	private readonly key: string;
	constructor(
		private readonly storage: Action3dSaveStorage,
		playerId: string,
	) {
		this.key = action3dSaveStorageKey(playerId);
	}
	load(): LocalAction3dLoadResult {
		try {
			const serialized = this.storage.getItem(this.key);
			return serialized === null
				? { status: "empty" }
				: decodeAction3dSave(serialized);
		} catch {
			return { status: "error", message: "Browser storage is unavailable." };
		}
	}
	save(state: Action3dState, savedAt?: string): LocalAction3dWriteResult {
		try {
			const save = createAction3dSave(state, savedAt);
			this.storage.setItem(this.key, JSON.stringify(save));
			return { ok: true, save };
		} catch {
			return { ok: false, message: "Could not write the Action3D checkpoint." };
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
