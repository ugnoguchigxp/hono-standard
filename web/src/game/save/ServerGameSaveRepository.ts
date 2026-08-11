import {
	createGameSave,
	decodeGameSave,
	type GameSaveEnvelope,
	type GameState,
} from "@shared/game";
import type {
	GetGameSaveResponse,
	PutGameSaveRequest,
	PutGameSaveResponse,
	ServerGameSaveRecord,
} from "@shared/schemas/game-save.schema";
import { ApiRequestError, fetchRpgGameSave, putRpgGameSave } from "../../api";
import {
	gameSaveStorageKey,
	LocalGameSaveRepository,
	type GameSaveStorage,
	type LocalGameSaveLoadResult,
} from "./LocalGameSaveRepository";

export type GameSaveLoadResult =
	| { status: "empty"; source: "server" }
	| { status: "error"; message: string; source: "server" | "local" }
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
			message: string;
			save?: GameSaveEnvelope;
			synced: false;
	  };

export interface GameSaveRepository {
	load(signal?: AbortSignal): Promise<GameSaveLoadResult> | GameSaveLoadResult;
	save(
		state: GameState,
		savedAt?: string,
	): Promise<GameSaveWriteResult> | GameSaveWriteResult;
}

export type GameSaveRemote = {
	load(signal?: AbortSignal): Promise<GetGameSaveResponse>;
	save(
		request: PutGameSaveRequest,
		signal?: AbortSignal,
	): Promise<PutGameSaveResponse>;
};

type PendingWrite = {
	save: GameSaveEnvelope;
	idempotencyKey: string;
	expectedRevision?: number | null;
};

type PendingQueue = {
	version: 1;
	writes: PendingWrite[];
};

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createDefaultRemote = (expectedOwner: string): GameSaveRemote => ({
	load: (signal) => fetchRpgGameSave(expectedOwner, signal),
	save: (request, signal) => putRpgGameSave(request, expectedOwner, signal),
});

export const pendingGameSaveStorageKey = (playerId: string): string =>
	`${gameSaveStorageKey(playerId)}:pending-cloud-writes`;

const decodeServerRecord = (record: ServerGameSaveRecord): GameSaveEnvelope => {
	const decoded = decodeGameSave(JSON.stringify(record.save));
	if (decoded.status !== "ready" || decoded.migrated) {
		throw new Error("The cloud checkpoint is invalid or unsupported.");
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

	constructor(
		private readonly storage: GameSaveStorage,
		playerId: string,
		remote?: GameSaveRemote,
	) {
		this.local = new LocalGameSaveRepository(storage, playerId);
		this.pendingKey = pendingGameSaveStorageKey(playerId);
		this.remote = remote ?? createDefaultRemote(playerId);
	}

	async load(signal?: AbortSignal): Promise<GameSaveLoadResult> {
		const local = this.local.load();
		try {
			const pendingResult = await this.flushPending(signal);
			const response = await this.remote.load(signal);
			this.remoteRevision = response.save?.revision ?? null;

			if (response.save) {
				const save = decodeServerRecord(response.save);
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
			this.remoteRevision = undefined;
			return localResultWithSource(
				local,
				error instanceof ApiRequestError && error.status === 409
					? "Cloud progress changed in another browser. Your browser backup is safe and will retry."
					: "Cloud saves are unavailable. Using the browser backup; sync will retry automatically.",
			);
		}
	}

	save(state: GameState, savedAt?: string): Promise<GameSaveWriteResult> {
		const save = createGameSave(state, savedAt);
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
			} catch {
				return {
					ok: false,
					message: localResult.ok
						? "Checkpoint kept in this browser; cloud sync will retry."
						: "Checkpoint could not be saved locally or to the cloud.",
					save: localResult.ok ? localResult.save : undefined,
					synced: false,
				};
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

	private loadPending(): PendingWrite[] {
		if (this.pendingMemory) return [...this.pendingMemory];
		try {
			const serialized = this.storage.getItem(this.pendingKey);
			if (!serialized) return [];
			const parsed = JSON.parse(serialized) as Partial<PendingQueue>;
			if (parsed.version !== 1 || !Array.isArray(parsed.writes)) {
				throw new Error("Invalid pending save queue.");
			}
			const writes = parsed.writes.map((candidate) => {
				if (
					typeof candidate !== "object" ||
					candidate === null ||
					typeof candidate.idempotencyKey !== "string" ||
					!UUID_PATTERN.test(candidate.idempotencyKey) ||
					(candidate.expectedRevision !== undefined &&
						candidate.expectedRevision !== null &&
						(!Number.isInteger(candidate.expectedRevision) ||
							candidate.expectedRevision < 1))
				) {
					throw new Error("Invalid pending save operation.");
				}
				const decoded = decodeGameSave(JSON.stringify(candidate.save));
				if (decoded.status !== "ready" || decoded.migrated) {
					throw new Error("Invalid pending save payload.");
				}
				return { ...candidate, save: decoded.save } as PendingWrite;
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
					JSON.stringify({ version: 1, writes } satisfies PendingQueue),
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
	): Promise<ServerGameSaveRecord> {
		const writes = this.loadPending();
		writes.push({
			save,
			idempotencyKey: crypto.randomUUID(),
			expectedRevision: writes.length === 0 ? this.remoteRevision : undefined,
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
			let expectedRevision =
				write.expectedRevision !== undefined
					? write.expectedRevision
					: this.remoteRevision;
			if (expectedRevision === undefined) {
				const current = await this.remote.load(signal);
				expectedRevision = current.save?.revision ?? null;
				this.remoteRevision = expectedRevision;
			}

			let response: PutGameSaveResponse;
			try {
				response = await this.remote.save(
					{ ...write, expectedRevision },
					signal,
				);
			} catch (error) {
				if (!(error instanceof ApiRequestError) || error.status !== 409)
					throw error;
				const current = await this.remote.load(signal);
				const rebased = {
					...write,
					expectedRevision: current.save?.revision ?? null,
					idempotencyKey: crypto.randomUUID(),
				};
				writes[0] = rebased;
				this.storePending(writes);
				response = await this.remote.save(rebased, signal);
			}

			lastRecord = response.save;
			decodeServerRecord(lastRecord);
			this.remoteRevision = lastRecord.revision;
			writes.shift();
			this.storePending(writes);
		}
		return lastRecord;
	}
}
