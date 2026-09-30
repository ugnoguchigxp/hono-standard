import type { Value } from "platejs";

export const PAGE_DRAFT_RECOVERY_TTL_MS = 30 * 60 * 1000;

export type PageDraftRecovery =
	| { kind: "title"; value: string }
	| { kind: "content"; value: Value; revision: number };

type StoredDraft = {
	draft: PageDraftRecovery;
	expiresAt: number;
};

const drafts = new Map<string, StoredDraft>();
// Keep only per-key generations after a draft is cleared or expires. Old
// requests can then distinguish an empty key from the same key's earlier
// empty state without retaining the draft contents.
const generations = new Map<string, number>();

function draftKey(
	userId: string,
	pageId: string,
	kind: PageDraftRecovery["kind"],
): string {
	return JSON.stringify([userId, pageId, kind]);
}

function removeExpiredDrafts(now: number): void {
	for (const [key, stored] of drafts) {
		if (stored.expiresAt <= now) {
			drafts.delete(key);
			bumpGeneration(key);
		}
	}
}

function generationFor(key: string): number {
	return generations.get(key) ?? 0;
}

function bumpGeneration(key: string): number {
	const generation = generationFor(key) + 1;
	generations.set(key, generation);
	return generation;
}

export function storePageDraftRecovery(
	userId: string,
	pageId: string,
	draft: PageDraftRecovery,
): number {
	const now = Date.now();
	removeExpiredDrafts(now);
	const key = draftKey(userId, pageId, draft.kind);
	bumpGeneration(key);
	drafts.set(key, {
		draft: structuredClone(draft),
		expiresAt: now + PAGE_DRAFT_RECOVERY_TTL_MS,
	});
	return generationFor(key);
}

export function readPageDraftRecovery<K extends PageDraftRecovery["kind"]>(
	userId: string,
	pageId: string,
	kind: K,
): Extract<PageDraftRecovery, { kind: K }> | null {
	const now = Date.now();
	removeExpiredDrafts(now);
	const stored = drafts.get(draftKey(userId, pageId, kind));
	return stored
		? (structuredClone(stored.draft) as Extract<PageDraftRecovery, { kind: K }>)
		: null;
}

export function pageDraftRecoveryVersion(
	userId: string,
	pageId: string,
	kind: PageDraftRecovery["kind"],
): number {
	removeExpiredDrafts(Date.now());
	return generationFor(draftKey(userId, pageId, kind));
}

export function storePageDraftRecoveryIfVersion(
	userId: string,
	pageId: string,
	draft: PageDraftRecovery,
	expectedVersion: number,
): number | null {
	if (
		pageDraftRecoveryVersion(userId, pageId, draft.kind) !== expectedVersion
	) {
		return null;
	}
	return storePageDraftRecovery(userId, pageId, draft);
}

export function clearPageDraftRecoveryIfVersion(
	userId: string,
	pageId: string,
	kind: PageDraftRecovery["kind"],
	expectedVersion: number,
): boolean {
	const key = draftKey(userId, pageId, kind);
	removeExpiredDrafts(Date.now());
	if (generationFor(key) !== expectedVersion) return false;
	drafts.delete(key);
	bumpGeneration(key);
	return true;
}

export function clearPageDraftRecovery(
	userId: string,
	pageId: string,
	kind?: PageDraftRecovery["kind"],
): void {
	if (kind) {
		const key = draftKey(userId, pageId, kind);
		drafts.delete(key);
		bumpGeneration(key);
		return;
	}
	for (const draftKind of ["title", "content"] as const) {
		const key = draftKey(userId, pageId, draftKind);
		drafts.delete(key);
		bumpGeneration(key);
	}
}
