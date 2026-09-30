import type { Value } from "platejs";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { HttpStatusError } from "../api";

export const PAGE_AUTOSAVE_DELAY_MS = 1000;

export type PageAutosaveStatus =
	| "saved"
	| "unsaved"
	| "saving"
	| "failed"
	| "conflict";

export const pageAutosaveStatusLabel: Record<PageAutosaveStatus, string> = {
	saved: "保存済み",
	unsaved: "未保存",
	saving: "保存中",
	failed: "保存できませんでした",
	conflict: "別の場所で更新されています",
};

export type PageAutosaveSnapshot = {
	latestValue: Value;
	status: PageAutosaveStatus;
	generation: number;
	confirmedRevision: number;
};

type SaveRequest = {
	revision: number;
	value: Value;
};

type SaveResult = {
	revision: number;
	value: Value;
};

type PageAutosaveTarget = {
	userId: string;
	pageId: string;
	value: Value;
	revision: number;
};

type FailureKind = "failed" | "conflict";

type SaveSnapshot = {
	sequence: number;
	value: Value;
	revision: number;
};

function jsonEqual(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function isConflict(error: unknown): boolean {
	return error instanceof HttpStatusError && error.status === 409;
}

function cloneValue(value: Value): Value {
	return structuredClone(value);
}

export class PageAutosaveController {
	private userId: string;
	private pageId: string;
	private latestValue: Value;
	private editSequence = 0;
	private savedSequence = 0;
	private confirmedRevision: number;
	private inFlight: SaveSnapshot | null = null;
	private failure: FailureKind | null = null;
	private generation = 0;
	private epoch = 0;
	private mounted = true;
	private suspended = false;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private snapshot: PageAutosaveSnapshot;
	private readonly listeners = new Set<() => void>();

	constructor(
		target: PageAutosaveTarget & {
			save: (input: SaveRequest) => Promise<SaveResult>;
			initialUnsaved?: boolean;
		},
	) {
		this.userId = target.userId;
		this.pageId = target.pageId;
		this.latestValue = cloneValue(target.value);
		this.confirmedRevision = target.revision;
		this.save = target.save;
		if (target.initialUnsaved) this.editSequence = 1;
		this.snapshot = this.buildSnapshot();
	}

	private save: (input: SaveRequest) => Promise<SaveResult>;

	getSnapshot = (): PageAutosaveSnapshot => this.snapshot;

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	activate(): void {
		this.mounted = true;
		if (
			this.inFlight ||
			this.failure ||
			this.editSequence === this.savedSequence
		) {
			return;
		}
		this.schedule();
	}

	deactivate(): void {
		this.mounted = false;
		this.clearTimer();
	}

	setTarget(next: PageAutosaveTarget): void {
		if (next.userId !== this.userId || next.pageId !== this.pageId) {
			this.epoch += 1;
			this.clearTimer();
			this.userId = next.userId;
			this.pageId = next.pageId;
			this.latestValue = cloneValue(next.value);
			this.confirmedRevision = next.revision;
			this.editSequence = 0;
			this.savedSequence = 0;
			this.inFlight = null;
			this.failure = null;
			this.suspended = false;
			this.generation += 1;
			this.publish();
			return;
		}
		this.applyExternalServer(next.value, next.revision);
	}

	noteChange = (value: Value): void => {
		if (!this.mounted) return;
		if (jsonEqual(value, this.latestValue)) return;
		this.latestValue = cloneValue(value);
		this.editSequence += 1;
		if (this.inFlight || this.failure || this.suspended) {
			this.clearTimer();
			this.publish();
			return;
		}
		this.schedule();
		this.publish();
	};

	suspend = (): void => {
		this.suspended = true;
		this.clearTimer();
	};

	resume = (): void => {
		if (!this.suspended) return;
		this.suspended = false;
		if (!this.mounted || this.inFlight || this.failure) return;
		if (this.editSequence === this.savedSequence) return;
		this.schedule();
	};

	saveNow = (): void => {
		this.clearTimer();
		this.flush("manual");
	};

	resetToServer = (value: Value, revision: number): void => {
		this.epoch += 1;
		this.clearTimer();
		this.latestValue = cloneValue(value);
		this.confirmedRevision = revision;
		this.editSequence += 1;
		this.savedSequence = this.editSequence;
		this.inFlight = null;
		this.failure = null;
		this.generation += 1;
		this.publish();
	};

	private applyExternalServer(value: Value, revision: number): void {
		if (this.inFlight || this.failure) return;
		if (this.editSequence !== this.savedSequence) return;
		if (revision <= this.confirmedRevision) return;
		this.latestValue = cloneValue(value);
		this.confirmedRevision = revision;
		this.generation += 1;
		this.publish();
	}

	private schedule(): void {
		this.clearTimer();
		if (!this.mounted || this.suspended) return;
		this.timer = setTimeout(() => {
			this.timer = null;
			this.flush("auto");
		}, PAGE_AUTOSAVE_DELAY_MS);
	}

	private clearTimer(): void {
		if (this.timer === null) return;
		clearTimeout(this.timer);
		this.timer = null;
	}

	private flush(mode: "auto" | "manual"): void {
		if (!this.mounted) return;
		if (mode === "auto" && this.suspended) return;
		if (this.inFlight) return;
		if (this.editSequence === this.savedSequence) return;
		if (this.failure === "conflict") return;
		if (mode === "auto" && this.failure) return;
		const epoch = this.epoch;
		const snapshot: SaveSnapshot = {
			sequence: this.editSequence,
			value: cloneValue(this.latestValue),
			revision: this.confirmedRevision,
		};
		this.failure = null;
		this.inFlight = snapshot;
		this.publish();
		void this.finish(snapshot, epoch);
	}

	private async finish(snapshot: SaveSnapshot, epoch: number): Promise<void> {
		try {
			const result = await this.save({
				revision: snapshot.revision,
				value: snapshot.value,
			});
			if (epoch !== this.epoch || this.inFlight !== snapshot) return;
			this.confirmedRevision = result.revision;
			this.savedSequence = snapshot.sequence;
			this.inFlight = null;
			if (
				this.editSequence === snapshot.sequence &&
				!jsonEqual(this.latestValue, result.value)
			) {
				this.latestValue = cloneValue(result.value);
				this.generation += 1;
			}
			this.publish();
			if (
				this.mounted &&
				!this.failure &&
				this.editSequence > this.savedSequence
			) {
				this.schedule();
			}
		} catch (error) {
			if (epoch !== this.epoch || this.inFlight !== snapshot) return;
			this.inFlight = null;
			this.failure = isConflict(error) ? "conflict" : "failed";
			this.publish();
		}
	}

	private buildSnapshot(): PageAutosaveSnapshot {
		return {
			latestValue: this.latestValue,
			status: this.status(),
			generation: this.generation,
			confirmedRevision: this.confirmedRevision,
		};
	}

	private status(): PageAutosaveStatus {
		if (this.failure === "conflict") return "conflict";
		if (this.failure === "failed") return "failed";
		if (this.inFlight) return "saving";
		if (this.editSequence > this.savedSequence) return "unsaved";
		return "saved";
	}

	private publish(): void {
		this.snapshot = this.buildSnapshot();
		for (const listener of this.listeners) listener();
	}
}

export function usePageAutosave({
	userId,
	pageId,
	serverValue,
	serverRevision,
	save,
	hold = false,
	initialUnsaved = false,
}: {
	userId: string;
	pageId: string;
	serverValue: Value;
	serverRevision: number;
	save: (input: SaveRequest) => Promise<SaveResult>;
	hold?: boolean;
	initialUnsaved?: boolean;
}) {
	const saveRef = useRef(save);
	saveRef.current = save;
	const controllerRef = useRef<PageAutosaveController | null>(null);
	if (controllerRef.current === null) {
		controllerRef.current = new PageAutosaveController({
			userId,
			pageId,
			value: serverValue,
			revision: serverRevision,
			save: (input) => saveRef.current(input),
			initialUnsaved,
		});
	}
	const controller = controllerRef.current;
	const held = useRef(false);
	if (held.current !== hold) {
		held.current = hold;
		if (hold) controller.suspend();
		else controller.resume();
	}
	const snapshot = useSyncExternalStore(
		controller.subscribe,
		controller.getSnapshot,
		controller.getSnapshot,
	);

	useEffect(() => {
		controller.setTarget({
			userId,
			pageId,
			value: serverValue,
			revision: serverRevision,
		});
	}, [controller, pageId, serverRevision, serverValue, userId]);

	useEffect(() => {
		controller.activate();
		return () => {
			controller.deactivate();
		};
	}, [controller]);

	return {
		latestValue: snapshot.latestValue,
		status: snapshot.status,
		generation: snapshot.generation,
		confirmedRevision: snapshot.confirmedRevision,
		onChange: controller.noteChange,
		saveNow: controller.saveNow,
		resetToServer: controller.resetToServer,
	};
}
