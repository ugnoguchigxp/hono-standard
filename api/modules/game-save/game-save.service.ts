import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { decodeGameSave, type GameSaveEnvelope } from "../../../shared/game";
import type { ServerGameSaveRecord } from "../../../shared/schemas/game-save.schema";
import type { AppDatabaseClient } from "../../db";
import { gameSaveOperations, gameSaves } from "../../db/schema";
import { HttpError } from "../auth/errors";

type SaveGameInput = {
	userId: string;
	gameId: string;
	slotId: string;
	save: GameSaveEnvelope;
	expectedRevision: number | null;
	idempotencyKey: string;
};

export type SaveGameResult = {
	record: ServerGameSaveRecord;
	idempotent: boolean;
};

const decodeStoredSave = (serialized: string): GameSaveEnvelope => {
	const decoded = decodeGameSave(serialized);
	if (decoded.status !== "ready" || decoded.migrated) {
		throw new HttpError(500, "Stored game save is invalid.");
	}
	return decoded.save;
};

const toRecord = (
	row: typeof gameSaves.$inferSelect,
): ServerGameSaveRecord => ({
	revision: row.revision,
	save: decodeStoredSave(row.saveJson),
	updatedAt: row.updatedAt.toISOString(),
});

const requestHash = (input: SaveGameInput, saveJson: string): string =>
	createHash("sha256")
		.update(
			JSON.stringify({
				expectedRevision: input.expectedRevision,
				save: JSON.parse(saveJson),
			}),
		)
		.digest("hex");

export class GameSaveService {
	constructor(private readonly database: AppDatabaseClient) {}

	async load(
		userId: string,
		gameId: string,
		slotId: string,
	): Promise<ServerGameSaveRecord | null> {
		const row = await this.database.read
			.select()
			.from(gameSaves)
			.where(
				and(
					eq(gameSaves.userId, userId),
					eq(gameSaves.gameId, gameId),
					eq(gameSaves.slotId, slotId),
				),
			)
			.get();
		return row ? toRecord(row) : null;
	}

	async save(input: SaveGameInput): Promise<SaveGameResult> {
		const saveJson = JSON.stringify(input.save);
		const hash = requestHash(input, saveJson);
		return this.database.write.execute((db) =>
			db.transaction((tx) => {
				const previousOperation = tx
					.select()
					.from(gameSaveOperations)
					.where(
						and(
							eq(gameSaveOperations.userId, input.userId),
							eq(gameSaveOperations.gameId, input.gameId),
							eq(gameSaveOperations.slotId, input.slotId),
							eq(gameSaveOperations.idempotencyKey, input.idempotencyKey),
						),
					)
					.get();
				if (previousOperation) {
					if (previousOperation.requestHash !== hash) {
						throw new HttpError(
							409,
							"The idempotency key was already used for another save.",
						);
					}
					return {
						record: {
							revision: previousOperation.resultRevision,
							save: decodeStoredSave(previousOperation.resultSaveJson),
							updatedAt: previousOperation.resultUpdatedAt,
						},
						idempotent: true,
					};
				}

				const existing = tx
					.select()
					.from(gameSaves)
					.where(
						and(
							eq(gameSaves.userId, input.userId),
							eq(gameSaves.gameId, input.gameId),
							eq(gameSaves.slotId, input.slotId),
						),
					)
					.get();
				const actualRevision = existing?.revision ?? null;
				if (actualRevision !== input.expectedRevision) {
					throw new HttpError(
						409,
						`Save revision conflict; expected ${String(input.expectedRevision)}, current ${String(actualRevision)}.`,
					);
				}

				const now = new Date();
				const revision = (existing?.revision ?? 0) + 1;
				if (existing) {
					tx.update(gameSaves)
						.set({
							revision,
							contentVersion: input.save.state.contentVersion,
							stateRevision: input.save.state.revision,
							savedAt: input.save.savedAt,
							saveJson,
							updatedAt: now,
						})
						.where(eq(gameSaves.id, existing.id))
						.run();
				} else {
					tx.insert(gameSaves)
						.values({
							userId: input.userId,
							gameId: input.gameId,
							slotId: input.slotId,
							revision,
							contentVersion: input.save.state.contentVersion,
							stateRevision: input.save.state.revision,
							savedAt: input.save.savedAt,
							saveJson,
							createdAt: now,
							updatedAt: now,
						})
						.run();
				}

				const updatedAt = now.toISOString();
				tx.insert(gameSaveOperations)
					.values({
						userId: input.userId,
						gameId: input.gameId,
						slotId: input.slotId,
						idempotencyKey: input.idempotencyKey,
						requestHash: hash,
						resultRevision: revision,
						resultSaveJson: saveJson,
						resultUpdatedAt: updatedAt,
						createdAt: now,
					})
					.run();

				return {
					record: { revision, save: input.save, updatedAt },
					idempotent: false,
				};
			}),
		);
	}

	async delete(
		userId: string,
		gameId: string,
		slotId: string,
	): Promise<boolean> {
		return this.database.write.execute((db) =>
			db.transaction((tx) => {
				const deleted = tx
					.delete(gameSaves)
					.where(
						and(
							eq(gameSaves.userId, userId),
							eq(gameSaves.gameId, gameId),
							eq(gameSaves.slotId, slotId),
						),
					)
					.returning({ id: gameSaves.id })
					.all();
				tx.delete(gameSaveOperations)
					.where(
						and(
							eq(gameSaveOperations.userId, userId),
							eq(gameSaveOperations.gameId, gameId),
							eq(gameSaveOperations.slotId, slotId),
						),
					)
					.run();
				return deleted.length > 0;
			}),
		);
	}
}
