import { createHash } from "node:crypto";
import { and, desc, eq, type SQL, sql } from "drizzle-orm";
import {
	type Action3dContentRegistry,
	type Action3dSaveEnvelope,
	decodeAction3dSave,
} from "../../../shared/action3d";
import {
	assertGameStateCompatible,
	decodeGameSave,
	type GameContentRegistry,
	type GameSaveEnvelope,
} from "../../../shared/game";
import { GAME_IDS } from "../../../shared/game-platform";
import type {
	GameSaveHistoryMetadata,
	GameSaveSlotMetadata,
	GameSaveWriteIntent,
	ServerGameSaveRecord,
	SupportedGameSaveEnvelope,
} from "../../../shared/schemas/game-save.schema";
import type { AppDatabaseClient } from "../../db";
import {
	gameSaveOperations,
	gameSaves,
	gameSaveVersions,
} from "../../db/schema";
import { HttpError } from "../auth/errors";

type SaveGameInput = {
	userId: string;
	gameId: string;
	slotId: string;
	save: SupportedGameSaveEnvelope;
	intent?: GameSaveWriteIntent;
	baseRevision?: number | null;
	expectedRevision: number | null;
	idempotencyKey: string;
};

export type SaveGameResult = {
	record: ServerGameSaveRecord<SupportedGameSaveEnvelope>;
	idempotent: boolean;
};

const decodeStoredSave = (
	serialized: string,
	gameId: string = GAME_IDS.rpg2d,
): SupportedGameSaveEnvelope => {
	const decoded =
		gameId === GAME_IDS.action3d
			? decodeAction3dSave(serialized)
			: decodeGameSave(serialized);
	if (
		decoded.status !== "ready" ||
		(gameId === GAME_IDS.action3d && decoded.migrated)
	) {
		throw new HttpError(500, "Stored game save is invalid.");
	}
	return decoded.save;
};

const toRecord = (
	row: typeof gameSaves.$inferSelect,
): ServerGameSaveRecord<SupportedGameSaveEnvelope> => ({
	revision: row.revision,
	save: decodeStoredSave(row.saveJson, row.gameId),
	updatedAt: row.updatedAt.toISOString(),
});

const requestHash = (input: SaveGameInput, saveJson: string): string =>
	createHash("sha256")
		.update(
			JSON.stringify({
				intent: input.intent,
				baseRevision: input.baseRevision,
				expectedRevision: input.expectedRevision,
				save: JSON.parse(saveJson),
			}),
		)
		.digest("hex");

const saveChecksum = (saveJson: string): string =>
	createHash("sha256").update(saveJson).digest("hex");

const AUTOSAVE_HISTORY_LIMIT = 10;
const MANUAL_HISTORY_LIMIT = 3;
const OPERATION_LIMIT = 128;
const OPERATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;

type SqlRunner = { run(query: SQL): unknown };

const runSql = (database: unknown, query: SQL): void => {
	const runner = database as Partial<SqlRunner>;
	runner.run?.(query);
};

export class GameSaveService {
	constructor(
		private readonly database: AppDatabaseClient,
		private readonly contentRegistry?: GameContentRegistry,
		private readonly action3dContentRegistry?: Action3dContentRegistry,
	) {}

	private assertContentCompatible(
		save: SupportedGameSaveEnvelope,
		gameId: string,
	): void {
		if (gameId === GAME_IDS.action3d) {
			if (!this.action3dContentRegistry) return;
			const state = (save as Action3dSaveEnvelope).state;
			try {
				if (
					state.contentVersion !== this.action3dContentRegistry.contentVersion
				)
					throw new Error("Version mismatch.");
				this.action3dContentRegistry.getWorld(state.location.worldId);
				for (const enemy of state.enemies)
					this.action3dContentRegistry.getEnemyArchetype(enemy.archetypeId);
			} catch {
				throw new HttpError(
					400,
					"Action3D save content is incompatible with the current world.",
				);
			}
			return;
		}
		if (!this.contentRegistry) return;
		try {
			assertGameStateCompatible(
				(save as GameSaveEnvelope).state,
				this.contentRegistry,
			);
		} catch {
			throw new HttpError(
				400,
				"Game save content is incompatible with the current world.",
			);
		}
	}

	private toSlotMetadata(
		row: typeof gameSaves.$inferSelect,
	): GameSaveSlotMetadata {
		let status: GameSaveSlotMetadata["status"] = "ready";
		let mapId: string | null = null;
		let checkpointId: string | null = null;
		try {
			const save = decodeStoredSave(row.saveJson, row.gameId);
			this.assertContentCompatible(save, row.gameId);
			if ("location" in save.state && "mapId" in save.state.location) {
				mapId = save.state.location.mapId;
				checkpointId = save.state.location.checkpointId;
			}
		} catch (error) {
			status =
				error instanceof HttpError && error.status === 400
					? "incompatible"
					: "corrupt";
		}
		return {
			slotId: row.slotId as GameSaveSlotMetadata["slotId"],
			revision: row.revision,
			savedAt: row.savedAt,
			updatedAt: row.updatedAt.toISOString(),
			contentVersion: row.contentVersion,
			stateRevision: row.stateRevision,
			mapId,
			checkpointId,
			status,
		};
	}

	private async findRecoveryCandidate(
		userId: string,
		gameId: string,
		slotId: string,
		currentRevision: number,
	): Promise<ServerGameSaveRecord<SupportedGameSaveEnvelope> | null> {
		const rows = await this.database.read
			.select()
			.from(gameSaveVersions)
			.where(
				and(
					eq(gameSaveVersions.userId, userId),
					eq(gameSaveVersions.gameId, gameId),
					eq(gameSaveVersions.slotId, slotId),
				),
			)
			.orderBy(desc(gameSaveVersions.revision))
			.all();
		for (const row of rows) {
			try {
				const save = decodeStoredSave(row.saveJson, gameId);
				if (
					/^[0-9a-f]{64}$/i.test(row.checksum) &&
					saveChecksum(row.saveJson) !== row.checksum
				) {
					continue;
				}
				this.assertContentCompatible(save, gameId);
				return {
					revision: row.revision,
					save,
					updatedAt: row.createdAt.toISOString(),
					recovery: {
						currentRevision,
						sourceRevision: row.revision,
					},
				};
			} catch {
				// Continue to the next verified historical snapshot.
			}
		}
		return null;
	}

	async load(
		userId: string,
		gameId: string,
		slotId: string,
	): Promise<ServerGameSaveRecord<SupportedGameSaveEnvelope> | null> {
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
		if (!row) return null;
		let record: ServerGameSaveRecord<SupportedGameSaveEnvelope>;
		try {
			record = toRecord(row);
		} catch {
			const candidate = await this.findRecoveryCandidate(
				userId,
				gameId,
				slotId,
				row.revision,
			);
			if (candidate) return candidate;
			throw new HttpError(
				500,
				"Stored game save is invalid and has no recovery candidate.",
			);
		}
		if (gameId === GAME_IDS.action3d) {
			try {
				this.assertContentCompatible(record.save, gameId);
			} catch {
				throw new HttpError(500, "Stored Action3D save is incompatible.");
			}
			return record;
		}
		if (!this.contentRegistry) return record;
		try {
			assertGameStateCompatible(
				(record.save as GameSaveEnvelope).state,
				this.contentRegistry,
			);
		} catch {
			throw new HttpError(500, "Stored game save content is incompatible.");
		}
		return record;
	}

	async listSlots(
		userId: string,
		gameId: string,
	): Promise<GameSaveSlotMetadata[]> {
		const rows = await this.database.read
			.select()
			.from(gameSaves)
			.where(and(eq(gameSaves.userId, userId), eq(gameSaves.gameId, gameId)))
			.orderBy(gameSaves.slotId)
			.all();
		return rows.map((row) => this.toSlotMetadata(row));
	}

	async listHistory(
		userId: string,
		gameId: string,
		slotId: string,
	): Promise<GameSaveHistoryMetadata[]> {
		const rows = await this.database.read
			.select()
			.from(gameSaveVersions)
			.where(
				and(
					eq(gameSaveVersions.userId, userId),
					eq(gameSaveVersions.gameId, gameId),
					eq(gameSaveVersions.slotId, slotId),
				),
			)
			.orderBy(desc(gameSaveVersions.revision))
			.all();
		return rows.map((row) => {
			let mapId: string | null = null;
			let checkpointId: string | null = null;
			let status: GameSaveHistoryMetadata["status"] = "ready";
			try {
				const save = decodeStoredSave(row.saveJson, row.gameId);
				this.assertContentCompatible(save, row.gameId);
				if ("location" in save.state && "mapId" in save.state.location) {
					mapId = save.state.location.mapId;
					checkpointId = save.state.location.checkpointId;
				}
			} catch (error) {
				status =
					error instanceof HttpError && error.status === 400
						? "incompatible"
						: "corrupt";
			}
			return {
				slotId: row.slotId as GameSaveHistoryMetadata["slotId"],
				revision: row.revision,
				savedAt: row.savedAt,
				updatedAt: row.createdAt.toISOString(),
				contentVersion: row.contentVersion,
				stateRevision: row.stateRevision,
				mapId,
				checkpointId,
				status,
				checksum: row.checksum,
			};
		});
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
							save: decodeStoredSave(
								previousOperation.resultSaveJson,
								input.gameId,
							),
							updatedAt: previousOperation.resultUpdatedAt,
						},
						idempotent: true,
					};
				}

				this.assertContentCompatible(input.save, input.gameId);

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
				if (
					(input.intent ?? "advance") === "advance" &&
					(input.baseRevision === undefined
						? input.expectedRevision
						: input.baseRevision) !== input.expectedRevision
				) {
					throw new HttpError(
						409,
						"Normal save writes cannot change their base revision.",
					);
				}
				if (
					input.intent === "resolve-browser" &&
					input.baseRevision === input.expectedRevision
				) {
					throw new HttpError(
						409,
						"Conflict resolution requires divergent save revisions.",
					);
				}

				const now = new Date();
				const revision = (existing?.revision ?? 0) + 1;
				if (existing) {
					try {
						decodeStoredSave(existing.saveJson, input.gameId);
						tx.insert(gameSaveVersions)
							.values({
								userId: existing.userId,
								gameId: existing.gameId,
								slotId: existing.slotId,
								revision: existing.revision,
								contentVersion: existing.contentVersion,
								stateRevision: existing.stateRevision,
								savedAt: existing.savedAt,
								saveJson: existing.saveJson,
								checksum: saveChecksum(existing.saveJson),
								createdAt: now,
							})
							.onConflictDoNothing()
							.run();
					} catch {
						// A corrupt current row is never copied into verified history.
					}
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

				const historyLimit =
					input.slotId === "autosave"
						? AUTOSAVE_HISTORY_LIMIT
						: MANUAL_HISTORY_LIMIT;
				runSql(
					tx,
					sql`DELETE FROM ${gameSaveVersions}
						WHERE user_id = ${input.userId}
							AND game_id = ${input.gameId}
							AND slot_id = ${input.slotId}
							AND id NOT IN (
								SELECT id FROM ${gameSaveVersions}
								WHERE user_id = ${input.userId}
									AND game_id = ${input.gameId}
									AND slot_id = ${input.slotId}
								ORDER BY revision DESC
								LIMIT ${historyLimit}
							)`,
				);
				const operationCutoff = Math.floor(
					(now.getTime() - OPERATION_RETENTION_MS) / 1_000,
				);
				runSql(
					tx,
					sql`DELETE FROM ${gameSaveOperations}
						WHERE user_id = ${input.userId}
							AND game_id = ${input.gameId}
							AND slot_id = ${input.slotId}
							AND created_at < ${operationCutoff}
							AND idempotency_key <> ${input.idempotencyKey}`,
				);
				runSql(
					tx,
					sql`DELETE FROM ${gameSaveOperations}
						WHERE user_id = ${input.userId}
							AND game_id = ${input.gameId}
							AND slot_id = ${input.slotId}
							AND idempotency_key <> ${input.idempotencyKey}
							AND id NOT IN (
								SELECT id FROM ${gameSaveOperations}
								WHERE user_id = ${input.userId}
									AND game_id = ${input.gameId}
									AND slot_id = ${input.slotId}
								ORDER BY created_at DESC
								LIMIT ${OPERATION_LIMIT}
							)`,
				);

				return {
					record: { revision, save: input.save, updatedAt },
					idempotent: false,
				};
			}),
		);
	}

	async restore(
		userId: string,
		gameId: string,
		slotId: string,
		sourceRevision: number,
		expectedRevision: number,
		idempotencyKey: string,
	): Promise<SaveGameResult> {
		const source = await this.database.read
			.select()
			.from(gameSaveVersions)
			.where(
				and(
					eq(gameSaveVersions.userId, userId),
					eq(gameSaveVersions.gameId, gameId),
					eq(gameSaveVersions.slotId, slotId),
					eq(gameSaveVersions.revision, sourceRevision),
				),
			)
			.get();
		if (!source) throw new HttpError(404, "Game save history entry not found.");
		if (
			/^[0-9a-f]{64}$/i.test(source.checksum) &&
			saveChecksum(source.saveJson) !== source.checksum
		) {
			throw new HttpError(400, "Game save history checksum is invalid.");
		}
		const save = decodeStoredSave(source.saveJson, gameId);
		this.assertContentCompatible(save, gameId);
		return this.save({
			userId,
			gameId,
			slotId,
			save,
			intent: "reset",
			baseRevision: expectedRevision,
			expectedRevision,
			idempotencyKey,
		});
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
				tx.delete(gameSaveVersions)
					.where(
						and(
							eq(gameSaveVersions.userId, userId),
							eq(gameSaveVersions.gameId, gameId),
							eq(gameSaveVersions.slotId, slotId),
						),
					)
					.run();
				return deleted.length > 0;
			}),
		);
	}
}
