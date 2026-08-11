import type { GameSaveEnvelope } from "../game";

export const GAME_SAVE_MAX_BYTES = 256 * 1024;

export type ServerGameSaveRecord = {
	revision: number;
	save: GameSaveEnvelope;
	updatedAt: string;
};

export type GetGameSaveResponse = {
	save: ServerGameSaveRecord | null;
};

export type PutGameSaveRequest = {
	save: GameSaveEnvelope;
	expectedRevision: number | null;
	idempotencyKey: string;
};

export type PutGameSaveResponse = {
	save: ServerGameSaveRecord;
	idempotent: boolean;
};

export type DeleteGameSaveResponse = {
	deleted: boolean;
};
