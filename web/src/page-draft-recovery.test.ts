import { afterEach, describe, expect, it, vi } from "vitest";
import {
	clearPageDraftRecovery,
	clearPageDraftRecoveryIfVersion,
	PAGE_DRAFT_RECOVERY_TTL_MS,
	pageDraftRecoveryVersion,
	readPageDraftRecovery,
	storePageDraftRecovery,
	storePageDraftRecoveryIfVersion,
} from "./page-draft-recovery";

afterEach(() => {
	vi.useRealTimers();
	clearPageDraftRecovery("alice", "page");
	clearPageDraftRecovery("bob", "page");
});

describe("page draft recovery", () => {
	it("keeps drafts scoped to the original owner, page, and kind", () => {
		storePageDraftRecovery("alice", "page", {
			kind: "title",
			value: "Alice draft",
		});
		storePageDraftRecovery("alice", "page", {
			kind: "content",
			value: [{ type: "p", children: [{ text: "Alice body" }] }],
			revision: 4,
		});

		expect(readPageDraftRecovery("alice", "page", "title")).toEqual({
			kind: "title",
			value: "Alice draft",
		});
		expect(readPageDraftRecovery("alice", "page", "content")).toEqual({
			kind: "content",
			value: [{ type: "p", children: [{ text: "Alice body" }] }],
			revision: 4,
		});
		expect(readPageDraftRecovery("bob", "page", "title")).toBeNull();
		expect(readPageDraftRecovery("alice", "another-page", "title")).toBeNull();
	});

	it("returns isolated copies and expires drafts after a short in-memory window", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-30T00:00:00.000Z"));
		const value = [{ type: "p" as const, children: [{ text: "draft" }] }];
		storePageDraftRecovery("alice", "page", {
			kind: "content",
			value,
			revision: 2,
		});

		const recovered = readPageDraftRecovery("alice", "page", "content");
		if (recovered?.kind !== "content") {
			throw new Error("recovered body was missing");
		}
		recovered.value[0]!.children[0]!.text = "mutated copy";
		expect(readPageDraftRecovery("alice", "page", "content")?.value).toEqual(
			value,
		);

		vi.advanceTimersByTime(PAGE_DRAFT_RECOVERY_TTL_MS + 1);
		expect(readPageDraftRecovery("alice", "page", "content")).toBeNull();
	});

	it("does not let an older save clear or replace a newer recovery draft", () => {
		const oldVersion = pageDraftRecoveryVersion("alice", "page", "title");
		storePageDraftRecovery("alice", "page", {
			kind: "title",
			value: "new recovery draft",
		});

		expect(
			clearPageDraftRecoveryIfVersion("alice", "page", "title", oldVersion),
		).toBe(false);
		expect(
			storePageDraftRecoveryIfVersion(
				"alice",
				"page",
				{ kind: "title", value: "old late error" },
				oldVersion,
			),
		).toBeNull();
		expect(readPageDraftRecovery("alice", "page", "title")).toEqual({
			kind: "title",
			value: "new recovery draft",
		});
	});

	it.each([
		"title",
		"content",
	] as const)("does not resurrect a cancelled %s draft after a late 401", (kind) => {
		const staleRequestVersion = pageDraftRecoveryVersion("alice", "page", kind);
		const newerVersion = storePageDraftRecovery(
			"alice",
			"page",
			kind === "title"
				? { kind, value: "new title draft" }
				: {
						kind,
						value: [{ type: "p", children: [{ text: "new body draft" }] }],
						revision: 3,
					},
		);

		expect(
			clearPageDraftRecoveryIfVersion("alice", "page", kind, newerVersion),
		).toBe(true);
		expect(
			storePageDraftRecoveryIfVersion(
				"alice",
				"page",
				kind === "title"
					? { kind, value: "late old title" }
					: {
							kind,
							value: [{ type: "p", children: [{ text: "late old body" }] }],
							revision: 1,
						},
				staleRequestVersion,
			),
		).toBeNull();
		expect(readPageDraftRecovery("alice", "page", kind)).toBeNull();
	});

	it.each([
		"title",
		"content",
	] as const)("invalidates an old %s save token when its temporary draft expires", (kind) => {
		vi.useFakeTimers();
		const staleRequestVersion = pageDraftRecoveryVersion("alice", "page", kind);
		storePageDraftRecovery(
			"alice",
			"page",
			kind === "title"
				? { kind, value: "temporary title" }
				: {
						kind,
						value: [{ type: "p", children: [{ text: "temporary body" }] }],
						revision: 2,
					},
		);
		vi.advanceTimersByTime(PAGE_DRAFT_RECOVERY_TTL_MS + 1);

		expect(
			storePageDraftRecoveryIfVersion(
				"alice",
				"page",
				kind === "title"
					? { kind, value: "late old title" }
					: {
							kind,
							value: [{ type: "p", children: [{ text: "late old body" }] }],
							revision: 1,
						},
				staleRequestVersion,
			),
		).toBeNull();
		expect(readPageDraftRecovery("alice", "page", kind)).toBeNull();
	});
});
