import {
	AUTOSAVE_SLOT_ID,
	createGameSave,
	decodeGameSave,
	type GameSaveEnvelope,
	type GameSaveSlotId,
	type GameState,
} from "@shared/game";
import type {
	GameSaveSlotMetadata,
	GameSaveWriteIntent,
	GetGameSaveResponse,
	PutGameSaveRequest,
	PutGameSaveResponse,
	ServerGameSaveRecord,
} from "@shared/schemas/game-save.schema";
import { GAME_SAVE_PROTOCOL_VERSION as SAVE_PROTOCOL_VERSION } from "@shared/schemas/game-save.schema";
import {
	ApiRequestError,
	fetchRpgGameSave,
	listRpgGameSaveSlots,
	putRpgGameSave,
	restoreRpgGameSave,
} from "../../api";
import {
	type GameSaveStorage,
	gameSaveStorageKey,
	type LocalGameSaveLoadResult,
	LocalGameSaveRepository,
} from "./LocalGameSaveRepository";

export type GameSaveLoadResult =
	| { status: "empty"; source: "server" }
	| {
			status: "recovery";
			message: string;
			candidate: ServerGameSaveRecord;
			source: "server";
	  }
	| { status: "error"; message: string; source: "server" | "local" }
	| {
			status: "conflict";
			message: string;
			conflict: GameSaveConflict;
			source: "server";
	  }
	| {
			status: "ready";
			save: GameSaveEnvelope;
			migrated: boolean;
			source: "server" | "local";
			syncMessage?: string;
	  }
	| {
			status: "corrupt" | "unsupported";
			message: string;
			source: "local";
	  };

export type GameSaveWriteResult =
	| {
			ok: true;
			save: GameSaveEnvelope;
			revision: number;
			synced: true;
	  }
	| {
			ok: false;
			status: "queued-offline" | "rejected";
			message: string;
			save?: GameSaveEnvelope;
			synced: false;
			reason?: "timeout";
	  }
	| {
			ok: false;
			status: "conflict";
			message: string;
			conflict: GameSaveConflict;
			save: GameSaveEnvelope;
			synced: false;
	  };

export type GameSaveConflict = {
	browserSave: GameSaveEnvelope;
	cloudSave: ServerGameSaveRecord | null;
	baseRevision: number | null;
};

export type GameSaveConflictResolution = "cloud" | "browser";

export interface GameSaveRepository {
	load(signal?: AbortSignal): Promise<GameSaveLoadResult> | GameSaveLoadResult;
	save(
		state: GameState,
		savedAt?: string,
	): Promise<GameSaveWriteResult> | GameSaveWriteResult;
	reset?(
		state: GameState,
		savedAt?: string,
	): Promise<GameSaveWriteResult> | GameSaveWriteResult;
	resolveConflict?(
		conflict: GameSaveConflict,
		resolution: GameSaveConflictResolution,
	): Promise<GameSaveLoadResult> | GameSaveLoadResult;
	listSlots?(signal?: AbortSignal): Promise<GameSaveSlotMetadata[]>;
	loadSlot?(
		slotId: GameSaveSlotId,
		signal?: AbortSignal,
	): Promise<GameSaveLoadResult>;
	saveToSlot?(
		state: GameState,
		slotId: GameSaveSlotId,
		savedAt?: string,
	): Promise<GameSaveWriteResult>;
	restoreRecovery?(
		candidate: ServerGameSaveRecord,
	): Promise<GameSaveLoadResult>;
	pendingWriteCount?(): number;
}

export type GameSaveRemote = {
	load(signal?: AbortSignal): Promise<GetGameSaveResponse>;
	save(
		request: PutGameSaveRequest,
		signal?: AbortSignal,
	): Promise<PutGameSaveResponse>;
};

type PendingRevision = number | null | "unknown" | "previous";

type PendingWrite = {
	save: GameSaveEnvelope;
	idempotencyKey: string;
	intent: GameSaveWriteIntent;
	baseRevision: PendingRevision;
	expectedRevision: PendingRevision;
};

type PendingQueue = {
	version: 2;
	writes: PendingWrite[];
};

class CloudSaveConflictError extends Error {
	constructor(readonly conflict: GameSaveConflict) {
		super("Cloud progress changed in another browser.");
		this.name = "CloudSaveConflictError";
	}
}

class GameSaveTimeoutError extends Error {
	constructor() {
		super("Cloud save request timed out.");
		this.name = "GameSaveTimeoutError";
	}
}

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createDefaultRemote = (
	expectedOwner: string,
	slotId: GameSaveSlotId,
): GameSaveRemote => ({
	load: (signal) => fetchRpgGameSave(expectedOwner, signal, slotId),
	save: (request, signal) =>
		putRpgGameSave(request, expectedOwner, signal, slotId),
});

export const pendingGameSaveStorageKey = (
	playerId: string,
	slotId: GameSaveSlotId = AUTOSAVE_SLOT_ID,
): string => `${gameSaveStorageKey(playerId, slotId)}:pending-cloud-writes`;

const decodeServerRecord = (
	record: ServerGameSaveRecord,
	expectedSlotId?: GameSaveSlotId,
): GameSaveEnvelope => {
	const decoded = decodeGameSave(JSON.stringify(record.save));
	if (decoded.status !== "ready" || decoded.migrated) {
		throw new Error("The cloud checkpoint is invalid or unsupported.");
	}
	if (expectedSlotId && decoded.save.slotId !== expectedSlotId) {
		throw new Error("The cloud checkpoint belongs to another slot.");
	}
	return decoded.save;
};

const localResultWithSource = (
	result: LocalGameSaveLoadResult,
	message?: string,
): GameSaveLoadResult => {
	switch (result.status) {
		case "ready":
			return {
				...result,
				source: "local",
				syncMessage: message,
			};
		case "empty":
			return {
				status: "error",
				message: message ?? "Cloud saves are temporarily unavailable.",
				source: "server",
			};
		case "corrupt":
		case "unsupported":
		case "error":
			return { ...result, source: "local" };
	}
};

export class ServerGameSaveRepository implements GameSaveRepository {
	private readonly local: LocalGameSaveRepository;
	private readonly pendingKey: string;
	private readonly remote: GameSaveRemote;
	private remoteRevision: number | null | undefined;
	private pendingMemory: PendingWrite[] | undefined;
	private tail: Promise<void> = Promise.resolve();
	private readonly owner: string;

	constructor(
		private readonly storage: GameSaveStorage,
		playerId: string,
		remote?: GameSaveRemote,
		private readonly slotId: GameSaveSlotId = AUTOSAVE_SLOT_ID,
		private readonly requestTimeoutMs = 10_000,
	) {
		this.owner = playerId;
		this.local = new LocalGameSaveRepository(storage, playerId, slotId);
		this.pendingKey = pendingGameSaveStorageKey(playerId, slotId);
		this.remote = remote ?? createDefaultRemote(playerId, slotId);
	}

	async load(signal?: AbortSignal): Promise<GameSaveLoadResult> {
		const local = this.local.load();
		try {
			const pendingResult = await this.flushPending(signal);
			const response = await this.loadRemote(signal);
			this.remoteRevision =
				response.save?.recovery?.currentRevision ??
				response.save?.revision ??
				null;

			if (response.save) {
				if (response.save.recovery) {
					return {
						status: "recovery",
						message:
							"The current checkpoint is damaged. A verified earlier checkpoint can be restored.",
						candidate: response.save,
						source: "server",
					};
				}
				const save = decodeServerRecord(response.save, this.slotId);
				this.local.saveEnvelope(save);
				return {
					status: "ready",
					save,
					migrated: false,
					source: "server",
					syncMessage: pendingResult
						? "The browser backup was synced to your account."
						: undefined,
				};
			}

			if (local.status !== "ready") {
				return local.status === "empty"
					? { status: "empty", source: "server" }
					: localResultWithSource(local);
			}

			const uploaded = await this.enqueueAndFlush(local.save, signal);
			this.local.saveEnvelope(uploaded.save);
			return {
				status: "ready",
				save: uploaded.save,
				migrated: false,
				source: "server",
				syncMessage: "The browser checkpoint was moved to your account.",
			};
		} catch (error) {
			if (signal?.aborted) throw error;
			if (error instanceof CloudSaveConflictError) {
				return {
					status: "conflict",
					message:
						"Cloud progress changed in another browser. Choose which checkpoint to keep.",
					conflict: error.conflict,
					source: "server",
				};
			}
			this.remoteRevision = undefined;
			return localResultWithSource(
				local,
				error instanceof ApiRequestError && error.status === 409
					? "Cloud progress changed in another browser. Your browser backup is safe."
					: "Cloud saves are unavailable. Using the browser backup; sync will retry automatically.",
			);
		}
	}

	save(state: GameState, savedAt?: string): Promise<GameSaveWriteResult> {
		const save = createGameSave(state, savedAt, this.slotId);
		const localResult = this.local.saveEnvelope(save);
		return this.enqueue(async () => {
			try {
				const uploaded = await this.enqueueAndFlush(save);
				this.local.saveEnvelope(uploaded.save);
				return {
					ok: true,
					save: uploaded.save,
					revision: uploaded.revision,
					synced: true,
				};
			} catch (error) {
				if (error instanceof CloudSaveConflictError) {
					return {
						ok: false,
						status: "conflict",
						message:
							"Cloud progress changed in another browser. Choose which checkpoint to keep.",
						conflict: error.conflict,
						save,
						synced: false,
					};
				}
				return {
					ok: false,
					status: localResult.ok ? "queued-offline" : "rejected",
					message: localResult.ok
						? "Checkpoint kept in this browser; cloud sync will retry."
						: "Checkpoint could not be saved locally or to the cloud.",
					save: localResult.ok ? localResult.save : undefined,
					synced: false,
					...(error instanceof GameSaveTimeoutError
						? { reason: "timeout" as const }
						: {}),
				};
			}
		});
	}

	reset(state: GameState, savedAt?: string): Promise<GameSaveWriteResult> {
		const save = createGameSave(state, savedAt, this.slotId);
		const localResult = this.local.saveEnvelope(save);
		return this.enqueue(async () => {
			this.storePending([]);
			try {
				const uploaded = await this.enqueueAndFlush(save, undefined, "reset");
				this.local.saveEnvelope(uploaded.save);
				return {
					ok: true,
					save: uploaded.save,
					revision: uploaded.revision,
					synced: true,
				};
			} catch (error) {
				if (error instanceof CloudSaveConflictError) {
					return {
						ok: false,
						status: "conflict",
						message:
							"Cloud progress changed before the New Game replacement completed.",
						conflict: error.conflict,
						save,
						synced: false,
					};
				}
				return {
					ok: false,
					status: localResult.ok ? "queued-offline" : "rejected",
					message: localResult.ok
						? "New Game kept in this browser; cloud sync will retry."
						: "New Game could not be saved locally or to the cloud.",
					save: localResult.ok ? localResult.save : undefined,
					synced: false,
					...(error instanceof GameSaveTimeoutError
						? { reason: "timeout" as const }
						: {}),
				};
			}
		});
	}

	resolveConflict(
		conflict: GameSaveConflict,
		resolution: GameSaveConflictResolution,
	): Promise<GameSaveLoadResult> {
		return this.enqueue(async () => {
			this.storePending([]);
			this.remoteRevision = conflict.cloudSave?.revision ?? null;
			if (resolution === "cloud") {
				if (!conflict.cloudSave) {
					this.local.clear();
					return { status: "empty", source: "server" };
				}
				const save = decodeServerRecord(conflict.cloudSave, this.slotId);
				this.local.saveEnvelope(save);
				return {
					status: "ready",
					save,
					migrated: false,
					source: "server",
					syncMessage: "Cloud checkpoint kept.",
				};
			}

			const write: PendingWrite = {
				save: conflict.browserSave,
				idempotencyKey: crypto.randomUUID(),
				intent: "resolve-browser",
				baseRevision: conflict.baseRevision,
				expectedRevision: conflict.cloudSave?.revision ?? null,
			};
			this.storePending([write]);
			try {
				const uploaded = await this.flushPending();
				if (!uploaded) throw new Error("Conflict resolution was not saved.");
				this.local.saveEnvelope(uploaded.save);
				return {
					status: "ready",
					save: uploaded.save,
					migrated: false,
					source: "server",
					syncMessage: "Browser checkpoint kept in the cloud.",
				};
			} catch (error) {
				if (error instanceof CloudSaveConflictError) {
					return {
						status: "conflict",
						message:
							"Cloud progress changed again. Review the latest checkpoints.",
						conflict: error.conflict,
						source: "server",
					};
				}
				throw error;
			}
		});
	}

	async listSlots(signal?: AbortSignal): Promise<GameSaveSlotMetadata[]> {
		const load = () =>
			this.withTimeout(
				(operationSignal) => listRpgGameSaveSlots(this.owner, operationSignal),
				signal,
			);
		try {
			return (await load()).slots;
		} catch (error) {
			if (!this.shouldRetry(error, signal)) throw error;
			return (await load()).slots;
		}
	}

	loadSlot(
		slotId: GameSaveSlotId,
		signal?: AbortSignal,
	): Promise<GameSaveLoadResult> {
		if (slotId === this.slotId) return this.load(signal);
		return new ServerGameSaveRepository(
			this.storage,
			this.owner,
			undefined,
			slotId,
			this.requestTimeoutMs,
		).load(signal);
	}

	saveToSlot(
		state: GameState,
		slotId: GameSaveSlotId,
		savedAt?: string,
	): Promise<GameSaveWriteResult> {
		if (
			slotId !== AUTOSAVE_SLOT_ID &&
			(state.mode !== "field" || state.field.pendingTriggerId !== null)
		) {
			return Promise.resolve({
				ok: false,
				status: "rejected",
				message: "Manual saves are available only at a safe field position.",
				synced: false,
			});
		}
		if (slotId === this.slotId) return this.reset(state, savedAt);
		return new ServerGameSaveRepository(
			this.storage,
			this.owner,
			undefined,
			slotId,
			this.requestTimeoutMs,
		).reset(state, savedAt);
	}

	async restoreRecovery(
		candidate: ServerGameSaveRecord,
	): Promise<GameSaveLoadResult> {
		if (!candidate.recovery) {
			throw new Error("The checkpoint is not a recovery candidate.");
		}
		const response = await this.withTimeout((signal) =>
			restoreRpgGameSave(
				this.owner,
				this.slotId,
				candidate.recovery?.sourceRevision ?? candidate.revision,
				{
					protocolVersion: SAVE_PROTOCOL_VERSION,
					expectedRevision:
						candidate.recovery?.currentRevision ?? candidate.revision,
					idempotencyKey: crypto.randomUUID(),
				},
				signal,
			),
		);
		const save = decodeServerRecord(response.save, this.slotId);
		this.remoteRevision = response.save.revision;
		this.local.saveEnvelope(save);
		return {
			status: "ready",
			save,
			migrated: false,
			source: "server",
			syncMessage: "Earlier verified checkpoint restored.",
		};
	}

	pendingWriteCount(): number {
		return this.loadPending().length;
	}

	private async withTimeout<TResult>(
		operation: (signal: AbortSignal) => Promise<TResult>,
		externalSignal?: AbortSignal,
	): Promise<TResult> {
		if (externalSignal?.aborted) {
			throw new DOMException("The operation was aborted.", "AbortError");
		}
		const controller = new AbortController();
		const abortFromExternal = () => controller.abort(externalSignal?.reason);
		externalSignal?.addEventListener("abort", abortFromExternal, {
			once: true,
		});
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			return await Promise.race([
				operation(controller.signal),
				new Promise<never>((_resolve, reject) => {
					controller.signal.addEventListener(
						"abort",
						() =>
							reject(
								controller.signal.reason instanceof Error
									? controller.signal.reason
									: new DOMException(
											"The operation was aborted.",
											"AbortError",
										),
							),
						{ once: true },
					);
				}),
				new Promise<never>((_resolve, reject) => {
					timer = setTimeout(() => {
						controller.abort(new GameSaveTimeoutError());
						reject(new GameSaveTimeoutError());
					}, this.requestTimeoutMs);
				}),
			]);
		} finally {
			if (timer) clearTimeout(timer);
			externalSignal?.removeEventListener("abort", abortFromExternal);
		}
	}

	private shouldRetry(error: unknown, signal?: AbortSignal): boolean {
		return !signal?.aborted && !(error instanceof ApiRequestError);
	}

	private async loadRemote(signal?: AbortSignal): Promise<GetGameSaveResponse> {
		try {
			return await this.withTimeout(
				(operationSignal) => this.remote.load(operationSignal),
				signal,
			);
		} catch (error) {
			if (!this.shouldRetry(error, signal)) throw error;
			return this.withTimeout(
				(operationSignal) => this.remote.load(operationSignal),
				signal,
			);
		}
	}

	private async saveRemote(
		request: PutGameSaveRequest,
		signal?: AbortSignal,
	): Promise<PutGameSaveResponse> {
		try {
			return await this.withTimeout(
				(operationSignal) => this.remote.save(request, operationSignal),
				signal,
			);
		} catch (error) {
			if (!this.shouldRetry(error, signal)) throw error;
			return this.withTimeout(
				(operationSignal) => this.remote.save(request, operationSignal),
				signal,
			);
		}
	}

	private enqueue<TResult>(
		operation: () => Promise<TResult>,
	): Promise<TResult> {
		const result = this.tail.then(operation);
		this.tail = result.then(
			() => undefined,
			() => undefined,
		);
		return result;
	}

	private loadPending(): PendingWrite[] {
		if (this.pendingMemory) return [...this.pendingMemory];
		try {
			const serialized = this.storage.getItem(this.pendingKey);
			if (!serialized) return [];
			const parsed = JSON.parse(serialized) as {
				version?: number;
				writes?: unknown[];
			};
			if (
				(parsed.version !== 1 && parsed.version !== 2) ||
				!Array.isArray(parsed.writes)
			) {
				throw new Error("Invalid pending save queue.");
			}
			const writes = parsed.writes.map<PendingWrite>((candidate, index) => {
				const value = candidate as Record<string, unknown>;
				if (
					typeof candidate !== "object" ||
					candidate === null ||
					typeof value.idempotencyKey !== "string" ||
					!UUID_PATTERN.test(value.idempotencyKey) ||
					typeof value.save !== "object"
				) {
					throw new Error("Invalid pending save operation.");
				}
				const decoded = decodeGameSave(JSON.stringify(value.save));
				if (decoded.status !== "ready" || decoded.migrated) {
					throw new Error("Invalid pending save payload.");
				}
				if (parsed.version === 1) {
					const legacyExpected = value.expectedRevision;
					if (
						legacyExpected !== undefined &&
						legacyExpected !== null &&
						(!Number.isInteger(legacyExpected) ||
							(legacyExpected as number) < 1)
					) {
						throw new Error("Invalid pending save revision.");
					}
					const revision: PendingRevision =
						legacyExpected === undefined
							? index === 0
								? "unknown"
								: "previous"
							: (legacyExpected as number | null);
					return {
						save: decoded.save,
						idempotencyKey: value.idempotencyKey as string,
						intent: "advance",
						baseRevision: revision,
						expectedRevision: revision,
					};
				}
				const intent = value.intent;
				if (
					intent !== "advance" &&
					intent !== "resolve-browser" &&
					intent !== "reset"
				) {
					throw new Error("Invalid pending save intent.");
				}
				const parseRevision = (revision: unknown): PendingRevision => {
					if (revision === "unknown" || revision === "previous")
						return revision;
					if (
						revision === null ||
						(typeof revision === "number" &&
							Number.isInteger(revision) &&
							revision >= 1)
					) {
						return revision;
					}
					throw new Error("Invalid pending save revision.");
				};
				return {
					save: decoded.save,
					idempotencyKey: value.idempotencyKey as string,
					intent,
					baseRevision: parseRevision(value.baseRevision),
					expectedRevision: parseRevision(value.expectedRevision),
				};
			});
			return writes.slice(-32);
		} catch {
			try {
				this.storage.removeItem(this.pendingKey);
			} catch {
				// A corrupt persistent queue is still ignored when storage is locked.
			}
			return [];
		}
	}

	private storePending(writes: PendingWrite[]): void {
		try {
			if (writes.length === 0) {
				this.storage.removeItem(this.pendingKey);
			} else {
				this.storage.setItem(
					this.pendingKey,
					JSON.stringify({ version: 2, writes } satisfies PendingQueue),
				);
			}
			this.pendingMemory = undefined;
		} catch {
			// Keep idempotency metadata in memory so disabled storage does not block
			// an otherwise healthy authenticated server save.
			this.pendingMemory = [...writes];
		}
	}

	private async enqueueAndFlush(
		save: GameSaveEnvelope,
		signal?: AbortSignal,
		intent: GameSaveWriteIntent = "advance",
	): Promise<ServerGameSaveRecord> {
		const writes = this.loadPending();
		const revision: PendingRevision =
			writes.length > 0
				? "previous"
				: this.remoteRevision === undefined
					? "unknown"
					: this.remoteRevision;
		writes.push({
			save,
			idempotencyKey: crypto.randomUUID(),
			intent,
			baseRevision: revision,
			expectedRevision: revision,
		});
		this.storePending(writes);
		const record = await this.flushPending(signal);
		if (!record) throw new Error("Pending save queue was not flushed.");
		return record;
	}

	private async flushPending(
		signal?: AbortSignal,
	): Promise<ServerGameSaveRecord | null> {
		const writes = this.loadPending();
		let lastRecord: ServerGameSaveRecord | null = null;
		while (writes.length > 0) {
			const write = writes[0];
			let current: GetGameSaveResponse | undefined;
			const loadCurrent = async (): Promise<GetGameSaveResponse> => {
				if (!current) {
					current = await this.loadRemote(signal);
					this.remoteRevision = current.save?.revision ?? null;
				}
				return current;
			};
			const resolveRevision = async (
				revision: PendingRevision,
			): Promise<number | null> => {
				if (revision === "previous") {
					if (this.remoteRevision === undefined) await loadCurrent();
					return this.remoteRevision ?? null;
				}
				if (revision === "unknown") {
					const loaded = await loadCurrent();
					if (write.intent === "advance" && loaded.save) {
						throw new CloudSaveConflictError({
							browserSave: writes.at(-1)?.save ?? write.save,
							cloudSave: loaded.save,
							baseRevision: null,
						});
					}
					return loaded.save?.revision ?? null;
				}
				return revision;
			};
			const baseRevision = await resolveRevision(write.baseRevision);
			const expectedRevision = await resolveRevision(write.expectedRevision);
			const normalized = { ...write, baseRevision, expectedRevision };
			writes[0] = normalized;
			this.storePending(writes);

			let response: PutGameSaveResponse;
			try {
				response = await this.saveRemote(
					{
						protocolVersion: SAVE_PROTOCOL_VERSION,
						intent: normalized.intent,
						save: normalized.save,
						baseRevision,
						expectedRevision,
						idempotencyKey: normalized.idempotencyKey,
					},
					signal,
				);
			} catch (error) {
				if (!(error instanceof ApiRequestError) || error.status !== 409)
					throw error;
				current = undefined;
				const loaded = await loadCurrent();
				throw new CloudSaveConflictError({
					browserSave: writes.at(-1)?.save ?? normalized.save,
					cloudSave: loaded.save,
					baseRevision,
				});
			}

			lastRecord = response.save;
			decodeServerRecord(lastRecord, this.slotId);
			this.remoteRevision = lastRecord.revision;
			writes.shift();
			this.storePending(writes);
		}
		return lastRecord;
	}
}
