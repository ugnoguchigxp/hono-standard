import { zValidator } from "@hono/zod-validator";
import { AUTOSAVE_SLOT_ID, decodeGameSave } from "../../shared/game";
import { GAME_IDS } from "../../shared/game-platform";
import {
	GAME_SAVE_MAX_BYTES,
	type DeleteGameSaveResponse,
	type GetGameSaveResponse,
	type PutGameSaveResponse,
} from "../../shared/schemas/game-save.schema";
import { Hono } from "hono";
import { z } from "zod";
import { getAuthContextUser } from "../modules/auth/context";
import { HttpError } from "../modules/auth/errors";
import type { GameSaveService } from "../modules/game-save/game-save.service";

const putGameSaveSchema = z
	.object({
		save: z.unknown(),
		expectedRevision: z.number().int().positive().nullable(),
		idempotencyKey: z.string().uuid(),
	})
	.strict();

type GameSaveRouteService = Pick<GameSaveService, "load" | "save" | "delete">;

const getAuthorizedUserId = (c: Parameters<typeof getAuthContextUser>[0]) => {
	const user = getAuthContextUser(c);
	const expectedOwner = c.req.header("X-Game-Save-Owner")?.trim().toLowerCase();
	if (expectedOwner && expectedOwner !== user.email.trim().toLowerCase()) {
		throw new HttpError(403, "The authenticated save owner changed.");
	}
	return user.userId;
};

const assertSupportedSlot = (gameId: string, slotId: string): void => {
	if (gameId !== GAME_IDS.rpg2d || slotId !== AUTOSAVE_SLOT_ID) {
		throw new HttpError(404, "Game save slot not found.");
	}
};

export function createGameSaveRoute(service: GameSaveRouteService) {
	return new Hono()
		.get("/:gameId/saves/:slotId", async (c) => {
			const { gameId, slotId } = c.req.param();
			assertSupportedSlot(gameId, slotId);
			const userId = getAuthorizedUserId(c);
			const response = {
				save: await service.load(userId, gameId, slotId),
			} satisfies GetGameSaveResponse;
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
				const decoded = decodeGameSave(serialized);
				if (
					decoded.status !== "ready" ||
					decoded.migrated ||
					decoded.save.slotId !== slotId
				) {
					throw new HttpError(
						400,
						"Game save payload is invalid or unsupported.",
					);
				}
				const userId = getAuthorizedUserId(c);
				const result = await service.save({
					userId,
					gameId,
					slotId,
					save: decoded.save,
					expectedRevision: body.expectedRevision,
					idempotencyKey: body.idempotencyKey,
				});
				const response = {
					save: result.record,
					idempotent: result.idempotent,
				} satisfies PutGameSaveResponse;
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
