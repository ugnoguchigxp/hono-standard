import type { Action3dSaveEnvelope } from "../action3d";
import type { GameSaveEnvelope, GameSaveSlotId } from "../game";

export const GAME_SAVE_MAX_BYTES = 256 * 1024;
export const GAME_SAVE_PROTOCOL_VERSION = 2 as const;

export type GameSaveWriteIntent = "advance" | "resolve-browser" | "reset";

export type SupportedGameSaveEnvelope = GameSaveEnvelope | Action3dSaveEnvelope;

export type ServerGameSaveRecord<
	TSave extends SupportedGameSaveEnvelope = GameSaveEnvelope,
> = {
	revision: number;
	save: TSave;
	updatedAt: string;
	recovery?: {
		currentRevision: number;
		sourceRevision: number;
	};
};

export type GameSaveSlotMetadata = {
	slotId: GameSaveSlotId;
	revision: number;
	savedAt: string;
	updatedAt: string;
	contentVersion: string;
	stateRevision: number;
	mapId: string | null;
	checkpointId: string | null;
	status: "ready" | "corrupt" | "incompatible";
};

export type GameSaveHistoryMetadata = GameSaveSlotMetadata & {
	checksum: string;
};

export type ListGameSaveSlotsResponse = {
	slots: GameSaveSlotMetadata[];
};

export type ListGameSaveHistoryResponse = {
	history: GameSaveHistoryMetadata[];
};

export type RestoreGameSaveRequest = {
	protocolVersion: typeof GAME_SAVE_PROTOCOL_VERSION;
	expectedRevision: number;
	idempotencyKey: string;
};

export type GetGameSaveResponse<
	TSave extends SupportedGameSaveEnvelope = GameSaveEnvelope,
> = {
	save: ServerGameSaveRecord<TSave> | null;
};

export type PutGameSaveRequest<
	TSave extends SupportedGameSaveEnvelope = GameSaveEnvelope,
> = {
	protocolVersion: typeof GAME_SAVE_PROTOCOL_VERSION;
	intent: GameSaveWriteIntent;
	save: TSave;
	baseRevision: number | null;
	expectedRevision: number | null;
	idempotencyKey: string;
};

export type PutGameSaveResponse<
	TSave extends SupportedGameSaveEnvelope = GameSaveEnvelope,
> = {
	save: ServerGameSaveRecord<TSave>;
	idempotent: boolean;
};

export type DeleteGameSaveResponse = {
	deleted: boolean;
};
