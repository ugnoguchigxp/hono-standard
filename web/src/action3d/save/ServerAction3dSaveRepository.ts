import {
	type Action3dSaveEnvelope,
	type Action3dState,
	createAction3dSave,
	decodeAction3dSave,
} from "@shared/action3d";
import {
	GAME_SAVE_PROTOCOL_VERSION,
	type GetGameSaveResponse,
	type PutGameSaveRequest,
	type PutGameSaveResponse,
	type ServerGameSaveRecord,
} from "@shared/schemas/game-save.schema";
import {
	ApiRequestError,
	fetchAction3dGameSave,
	putAction3dGameSave,
} from "../../api";
import {
	type Action3dSaveStorage,
	action3dSaveStorageKey,
	type LocalAction3dLoadResult,
	LocalAction3dSaveRepository,
} from "./LocalAction3dSaveRepository";

export type Action3dCloudConflict = {
	browserSave: Action3dSaveEnvelope;
	cloudSave: ServerGameSaveRecord<Action3dSaveEnvelope> | null;
	baseRevision: number | null;
};
export type Action3dSaveConflictResolution = "cloud" | "browser";
export type Action3dSaveLoadResult =
	| { status: "empty"; source: "server" }
	| { status: "error"; message: string; source: "server" | "local" }
	| {
			status: "ready";
			save: Action3dSaveEnvelope;
			migrated: boolean;
			source: "server" | "local";
			syncMessage?: string;
	  }
	| {
			status: "corrupt" | "unsupported";
			message: string;
			source: "local";
	  }
	| {
			status: "conflict";
			message: string;
			conflict: Action3dCloudConflict;
			source: "server";
	  };
export type Action3dSaveWriteResult =
	| {
			ok: true;
			save: Action3dSaveEnvelope;
			revision: number;
			synced: true;
	  }
	| {
			ok: false;
			status: "queued-offline" | "conflict" | "rejected";
			message: string;
			save?: Action3dSaveEnvelope;
			conflict?: Action3dCloudConflict;
			synced: false;
	  };

export type Action3dSaveRemote = {
	load(
		signal?: AbortSignal,
	): Promise<GetGameSaveResponse<Action3dSaveEnvelope>>;
	save(
		request: PutGameSaveRequest<Action3dSaveEnvelope>,
		signal?: AbortSignal,
	): Promise<PutGameSaveResponse<Action3dSaveEnvelope>>;
};
type PendingRevision = number | null | "unknown" | "previous";
type PendingWrite = {
	save: Action3dSaveEnvelope;
	idempotencyKey: string;
	intent: "advance" | "resolve-browser";
	baseRevision: PendingRevision;
	expectedRevision: PendingRevision;
};
type PendingQueue = { version: 2; writes: PendingWrite[] };
const createRemote = (owner: string): Action3dSaveRemote => ({
	load: (signal) => fetchAction3dGameSave(owner, signal),
	save: (request, signal) => putAction3dGameSave(request, owner, signal),
});
const pendingKey = (playerId: string) =>
	`${action3dSaveStorageKey(playerId)}:pending-cloud-writes`;

const decodeRecord = (
	record: ServerGameSaveRecord<Action3dSaveEnvelope>,
): Action3dSaveEnvelope => {
	const decoded = decodeAction3dSave(JSON.stringify(record.save));
	if (decoded.status !== "ready" || decoded.migrated)
		throw new Error("The cloud Action3D checkpoint is invalid.");
	return decoded.save;
};
const localFallback = (
	result: LocalAction3dLoadResult,
	message: string,
): Action3dSaveLoadResult => {
	if (result.status === "ready")
		return { ...result, source: "local", syncMessage: message };
	if (result.status === "empty")
		return { status: "error", source: "server", message };
	return { ...result, source: "local" };
};

class Action3dCloudConflictError extends Error {
	constructor(readonly conflict: Action3dCloudConflict) {
		super("Action3D cloud checkpoint conflict.");
		this.name = "Action3dCloudConflictError";
	}
}

export class ServerAction3dSaveRepository {
	private readonly local: LocalAction3dSaveRepository;
	private readonly queueKey: string;
	private readonly remote: Action3dSaveRemote;
	private remoteRevision: number | null | undefined;
	private memoryQueue: PendingWrite[] | undefined;
	private tail: Promise<void> = Promise.resolve();

	constructor(
		private readonly storage: Action3dSaveStorage,
		playerId: string,
		remote?: Action3dSaveRemote,
	) {
		this.local = new LocalAction3dSaveRepository(storage, playerId);
		this.queueKey = pendingKey(playerId);
		this.remote = remote ?? createRemote(playerId);
	}

	async load(signal?: AbortSignal): Promise<Action3dSaveLoadResult> {
		const local = this.local.load();
		try {
			await this.flush(signal);
			const response = await this.remote.load(signal);
			this.remoteRevision = response.save?.revision ?? null;
			if (response.save) {
				const save = decodeRecord(response.save);
				this.local.saveEnvelope(save);
				return { status: "ready", save, migrated: false, source: "server" };
			}
			if (local.status !== "ready")
				return local.status === "empty"
					? { status: "empty", source: "server" }
					: localFallback(local, "Cloud saves are unavailable.");
			const record = await this.enqueueAndFlush(local.save, signal);
			this.local.saveEnvelope(record.save);
			return {
				status: "ready",
				save: record.save,
				migrated: false,
				source: "server",
				syncMessage: "The browser checkpoint was moved to your account.",
			};
		} catch (error) {
			if (signal?.aborted) throw error;
			if (error instanceof Action3dCloudConflictError)
				return {
					status: "conflict",
					message:
						"Cloud progress changed in another browser. Choose which checkpoint to keep.",
					conflict: error.conflict,
					source: "server",
				};
			return localFallback(
				local,
				error instanceof ApiRequestError && error.status === 409
					? "Cloud progress changed in another browser; the browser backup is safe."
					: "Cloud saves are unavailable. Using the browser backup; sync will retry.",
			);
		}
	}

	save(
		state: Action3dState,
		savedAt?: string,
	): Promise<Action3dSaveWriteResult> {
		const save = createAction3dSave(state, savedAt);
		const local = this.local.saveEnvelope(save);
		return this.enqueue(async () => {
			try {
				const record = await this.enqueueAndFlush(save);
				this.local.saveEnvelope(record.save);
				return {
					ok: true,
					save: record.save,
					revision: record.revision,
					synced: true,
				};
			} catch (error) {
				const conflict =
					error instanceof Action3dCloudConflictError
						? error.conflict
						: undefined;
				return {
					ok: false,
					status: conflict
						? "conflict"
						: local.ok
							? "queued-offline"
							: "rejected",
					message: conflict
						? "Cloud progress changed in another browser. Choose which checkpoint to keep."
						: local.ok
							? "Checkpoint kept in this browser; cloud sync will retry."
							: "Checkpoint could not be saved locally or to the cloud.",
					save: local.ok ? local.save : undefined,
					conflict,
					synced: false,
				};
			}
		});
	}

	resolveConflict(
		conflict: Action3dCloudConflict,
		resolution: Action3dSaveConflictResolution,
	): Promise<Action3dSaveLoadResult> {
		return this.enqueue(async () => {
			this.storeQueue([]);
			this.remoteRevision = conflict.cloudSave?.revision ?? null;
			if (resolution === "cloud") {
				if (!conflict.cloudSave) {
					this.local.clear();
					return { status: "empty", source: "server" };
				}
				const save = decodeRecord(conflict.cloudSave);
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
			this.storeQueue([write]);
			try {
				const record = await this.flush();
				if (!record) throw new Error("Conflict resolution was not saved.");
				this.local.saveEnvelope(record.save);
				return {
					status: "ready",
					save: record.save,
					migrated: false,
					source: "server",
					syncMessage: "Browser checkpoint kept in the cloud.",
				};
			} catch (error) {
				if (error instanceof Action3dCloudConflictError)
					return {
						status: "conflict",
						message:
							"Cloud progress changed again. Review the latest checkpoints.",
						conflict: error.conflict,
						source: "server",
					};
				throw error;
			}
		});
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
	private loadQueue(): PendingWrite[] {
		if (this.memoryQueue) return [...this.memoryQueue];
		try {
			const serialized = this.storage.getItem(this.queueKey);
			if (!serialized) return [];
			const value = JSON.parse(serialized) as {
				version?: number;
				writes?: Array<Record<string, unknown>>;
			};
			if (
				(value.version !== 1 && value.version !== 2) ||
				!Array.isArray(value.writes)
			)
				throw new Error();
			return value.writes.slice(-32).map((candidate, index) => {
				const decoded = decodeAction3dSave(JSON.stringify(candidate.save));
				if (decoded.status !== "ready" || decoded.migrated) throw new Error();
				const legacyExpected = candidate.expectedRevision as
					| number
					| null
					| "unknown"
					| undefined;
				if (value.version === 1) {
					const revision: PendingRevision =
						legacyExpected === undefined
							? index === 0
								? "unknown"
								: "previous"
							: legacyExpected;
					return {
						save: decoded.save,
						idempotencyKey: String(candidate.idempotencyKey),
						intent: "advance",
						baseRevision: revision,
						expectedRevision: revision,
					};
				}
				return {
					save: decoded.save,
					idempotencyKey: String(candidate.idempotencyKey),
					intent:
						candidate.intent === "resolve-browser"
							? "resolve-browser"
							: "advance",
					baseRevision: candidate.baseRevision as PendingRevision,
					expectedRevision: candidate.expectedRevision as PendingRevision,
				};
			});
		} catch {
			try {
				this.storage.removeItem(this.queueKey);
			} catch {
				/* ignored */
			}
			return [];
		}
	}
	private storeQueue(writes: PendingWrite[]): void {
		try {
			if (writes.length)
				this.storage.setItem(
					this.queueKey,
					JSON.stringify({ version: 2, writes } satisfies PendingQueue),
				);
			else this.storage.removeItem(this.queueKey);
			this.memoryQueue = undefined;
		} catch {
			this.memoryQueue = [...writes];
		}
	}
	private async enqueueAndFlush(
		save: Action3dSaveEnvelope,
		signal?: AbortSignal,
	): Promise<ServerGameSaveRecord<Action3dSaveEnvelope>> {
		const writes = this.loadQueue();
		const revision: PendingRevision =
			writes.length > 0
				? "previous"
				: this.remoteRevision === undefined
					? "unknown"
					: this.remoteRevision;
		writes.push({
			save,
			idempotencyKey: crypto.randomUUID(),
			intent: "advance",
			baseRevision: revision,
			expectedRevision: revision,
		});
		this.storeQueue(writes);
		const record = await this.flush(signal);
		if (!record) throw new Error("The Action3D pending queue was not flushed.");
		return record;
	}
	private async flush(
		signal?: AbortSignal,
	): Promise<ServerGameSaveRecord<Action3dSaveEnvelope> | null> {
		const writes = this.loadQueue();
		let last: ServerGameSaveRecord<Action3dSaveEnvelope> | null = null;
		while (writes.length) {
			const write = writes[0];
			let current: GetGameSaveResponse<Action3dSaveEnvelope> | undefined;
			const loadCurrent = async () => {
				if (!current) {
					current = await this.remote.load(signal);
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
					if (write.intent === "advance" && loaded.save)
						throw new Action3dCloudConflictError({
							browserSave: writes.at(-1)?.save ?? write.save,
							cloudSave: loaded.save,
							baseRevision: null,
						});
					return loaded.save?.revision ?? null;
				}
				return revision;
			};
			const baseRevision = await resolveRevision(write.baseRevision);
			const expectedRevision = await resolveRevision(write.expectedRevision);
			const normalized = { ...write, baseRevision, expectedRevision };
			writes[0] = normalized;
			this.storeQueue(writes);
			let response: PutGameSaveResponse<Action3dSaveEnvelope>;
			try {
				response = await this.remote.save(
					{
						protocolVersion: GAME_SAVE_PROTOCOL_VERSION,
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
				throw new Action3dCloudConflictError({
					browserSave: writes.at(-1)?.save ?? normalized.save,
					cloudSave: loaded.save,
					baseRevision,
				});
			}
			last = response.save;
			decodeRecord(last);
			this.remoteRevision = last.revision;
			writes.shift();
			if (writes[0]) {
				writes[0].baseRevision = last.revision;
				writes[0].expectedRevision = last.revision;
			}
			this.storeQueue(writes);
		}
		return last;
	}
}
