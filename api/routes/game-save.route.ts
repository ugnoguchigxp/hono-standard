import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import {
	ACTION3D_AUTOSAVE_SLOT,
	decodeAction3dSave,
} from "../../shared/action3d";
import { decodeGameSave, isGameSaveSlotId } from "../../shared/game";
import { GAME_IDS } from "../../shared/game-platform";
import {
	type DeleteGameSaveResponse,
	GAME_SAVE_MAX_BYTES,
	GAME_SAVE_PROTOCOL_VERSION,
	type GetGameSaveResponse,
	type ListGameSaveHistoryResponse,
	type ListGameSaveSlotsResponse,
	type PutGameSaveResponse,
	type RestoreGameSaveRequest,
	type SupportedGameSaveEnvelope,
} from "../../shared/schemas/game-save.schema";
import { getAuthContextUser } from "../modules/auth/context";
import { HttpError } from "../modules/auth/errors";
import type { GameSaveService } from "../modules/game-save/game-save.service";

const putGameSaveSchema = z
	.object({
		protocolVersion: z.literal(GAME_SAVE_PROTOCOL_VERSION),
		intent: z.enum(["advance", "resolve-browser", "reset"]),
		save: z.unknown(),
		baseRevision: z.number().int().positive().nullable(),
		expectedRevision: z.number().int().positive().nullable(),
		idempotencyKey: z.string().uuid(),
	})
	.strict();

const restoreGameSaveSchema: z.ZodType<RestoreGameSaveRequest> = z
	.object({
		protocolVersion: z.literal(GAME_SAVE_PROTOCOL_VERSION),
		expectedRevision: z.number().int().positive(),
		idempotencyKey: z.string().uuid(),
	})
	.strict();

type GameSaveRouteService = Pick<
	GameSaveService,
	"load" | "save" | "delete" | "listSlots" | "listHistory" | "restore"
>;

const getAuthorizedUserId = (c: Parameters<typeof getAuthContextUser>[0]) => {
	const user = getAuthContextUser(c);
	const expectedOwner = c.req.header("X-Game-Save-Owner")?.trim().toLowerCase();
	if (expectedOwner && expectedOwner !== user.email.trim().toLowerCase()) {
		throw new HttpError(403, "The authenticated save owner changed.");
	}
	return user.userId;
};

const assertSupportedSlot = (gameId: string, slotId: string): void => {
	const supported =
		(gameId === GAME_IDS.rpg2d && isGameSaveSlotId(slotId)) ||
		(gameId === GAME_IDS.action3d && slotId === ACTION3D_AUTOSAVE_SLOT);
	if (!supported) {
		throw new HttpError(404, "Game save slot not found.");
	}
};

export function createGameSaveRoute(service: GameSaveRouteService) {
	return new Hono()
		.get("/:gameId/saves", async (c) => {
			const { gameId } = c.req.param();
			if (gameId !== GAME_IDS.rpg2d) {
				throw new HttpError(404, "Game save collection not found.");
			}
			const response = {
				slots: await service.listSlots(getAuthorizedUserId(c), gameId),
			} satisfies ListGameSaveSlotsResponse;
			return c.json(response);
		})
		.get("/:gameId/saves/:slotId/history", async (c) => {
			const { gameId, slotId } = c.req.param();
			assertSupportedSlot(gameId, slotId);
			if (gameId !== GAME_IDS.rpg2d) {
				throw new HttpError(404, "Game save history not found.");
			}
			const response = {
				history: await service.listHistory(
					getAuthorizedUserId(c),
					gameId,
					slotId,
				),
			} satisfies ListGameSaveHistoryResponse;
			return c.json(response);
		})
		.post(
			"/:gameId/saves/:slotId/history/:revision/restore",
			zValidator("json", restoreGameSaveSchema),
			async (c) => {
				const { gameId, slotId, revision } = c.req.param();
				assertSupportedSlot(gameId, slotId);
				if (gameId !== GAME_IDS.rpg2d || !/^\d+$/.test(revision)) {
					throw new HttpError(404, "Game save history entry not found.");
				}
				const body = c.req.valid("json");
				const result = await service.restore(
					getAuthorizedUserId(c),
					gameId,
					slotId,
					Number(revision),
					body.expectedRevision,
					body.idempotencyKey,
				);
				const response = {
					save: result.record,
					idempotent: result.idempotent,
				} satisfies PutGameSaveResponse<SupportedGameSaveEnvelope>;
				return c.json(response);
			},
		)
		.get("/:gameId/saves/:slotId", async (c) => {
			const { gameId, slotId } = c.req.param();
			assertSupportedSlot(gameId, slotId);
			const userId = getAuthorizedUserId(c);
			const response = {
				save: await service.load(userId, gameId, slotId),
			} satisfies GetGameSaveResponse<SupportedGameSaveEnvelope>;
			return c.json(response);
		})
		.put(
			"/:gameId/saves/:slotId",
			zValidator("json", putGameSaveSchema),
			async (c) => {
				const { gameId, slotId } = c.req.param();
				assertSupportedSlot(gameId, slotId);
				const body = c.req.valid("json");
				const serialized = JSON.stringify(body.save);
				if (
					new TextEncoder().encode(serialized).byteLength > GAME_SAVE_MAX_BYTES
				) {
					throw new HttpError(413, "Game save payload is too large.");
				}
				const decoded =
					gameId === GAME_IDS.action3d
						? decodeAction3dSave(serialized)
						: decodeGameSave(serialized);
				if (
					decoded.status !== "ready" ||
					decoded.migrated ||
					(gameId === GAME_IDS.action3d &&
						(!("gameId" in decoded.save) || decoded.save.gameId !== gameId)) ||
					decoded.save.slotId !== slotId
				) {
					throw new HttpError(
						400,
						"Game save payload is invalid or unsupported.",
					);
				}
				const userId = getAuthorizedUserId(c);
				const saveInput = {
					userId,
					gameId,
					slotId,
					save: decoded.save,
					intent: body.intent,
					baseRevision: body.baseRevision,
					expectedRevision: body.expectedRevision,
					idempotencyKey: body.idempotencyKey,
				};
				const result = await service.save(saveInput);
				const response = {
					save: result.record,
					idempotent: result.idempotent,
				} satisfies PutGameSaveResponse<SupportedGameSaveEnvelope>;
				return c.json(response);
			},
		)
		.delete("/:gameId/saves/:slotId", async (c) => {
			const { gameId, slotId } = c.req.param();
			assertSupportedSlot(gameId, slotId);
			const userId = getAuthorizedUserId(c);
			const response = {
				deleted: await service.delete(userId, gameId, slotId),
			} satisfies DeleteGameSaveResponse;
			return c.json(response);
		});
}
