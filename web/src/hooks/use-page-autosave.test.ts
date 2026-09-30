import type { Value } from "platejs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpStatusError, PageContentConflictError } from "../api";
import {
	PAGE_AUTOSAVE_DELAY_MS,
	PageAutosaveController,
	pageAutosaveStatusLabel,
	type PageAutosaveSnapshot,
} from "./use-page-autosave";

type SaveResult = { revision: number; value: Value };

function document(text: string): Value {
	return [{ type: "p", children: [{ text }] }];
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function createController(
	save: (input: { revision: number; value: Value }) => Promise<SaveResult>,
	partial: {
		userId?: string;
		pageId?: string;
		revision?: number;
		text?: string;
	} = {},
) {
	return new PageAutosaveController({
		userId: partial.userId ?? "user-a",
		pageId: partial.pageId ?? "page-a",
		value: document(partial.text ?? ""),
		revision: partial.revision ?? 0,
		save,
	});
}

async function settle(): Promise<void> {
	await vi.advanceTimersByTimeAsync(0);
}

describe("page autosave controller", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("waits one second after the last edit before saving", async () => {
		const save =
			vi.fn<
				(input: { revision: number; value: Value }) => Promise<SaveResult>
			>();
		const pending = deferred<SaveResult>();
		save.mockImplementation(() => pending.promise);
		const controller = createController(save);

		controller.noteChange(document("hello"));
		await vi.advanceTimersByTimeAsync(PAGE_AUTOSAVE_DELAY_MS - 1);

		expect(save).not.toHaveBeenCalled();
		expect(label(controller.getSnapshot())).toBe("未保存");

		await vi.advanceTimersByTimeAsync(1);

		expect(save).toHaveBeenCalledTimes(1);
		expect(save.mock.calls[0]?.[0]).toEqual({
			revision: 0,
			value: document("hello"),
		});
		expect(label(controller.getSnapshot())).toBe("保存中");
	});

	it("sends the latest value one second after the last edit", async () => {
		const save = vi.fn(async (input: { revision: number; value: Value }) => ({
			revision: input.revision + 1,
			value: input.value,
		}));
		const controller = createController(save);

		controller.noteChange(document("a"));
		await vi.advanceTimersByTimeAsync(PAGE_AUTOSAVE_DELAY_MS - 1);
		controller.noteChange(document("ab"));
		await vi.advanceTimersByTimeAsync(PAGE_AUTOSAVE_DELAY_MS - 1);
		expect(save).not.toHaveBeenCalled();
		expect(label(controller.getSnapshot())).toBe("未保存");

		await vi.advanceTimersByTimeAsync(1);
		await settle();

		expect(save).toHaveBeenCalledTimes(1);
		expect(save.mock.calls[0]?.[0]).toEqual({
			revision: 0,
			value: document("ab"),
		});
		expect(controller.getSnapshot().confirmedRevision).toBe(1);
		expect(label(controller.getSnapshot())).toBe("保存済み");
	});

	it("does not restart the timer when the document text is unchanged", async () => {
		const save = vi.fn(async (input: { revision: number; value: Value }) => ({
			revision: input.revision + 1,
			value: input.value,
		}));
		const controller = createController(save);

		controller.noteChange(document("same"));
		await vi.advanceTimersByTimeAsync(500);
		controller.noteChange(structuredClone(document("same")));
		await vi.advanceTimersByTimeAsync(500);
		await settle();

		expect(save).toHaveBeenCalledTimes(1);
		expect(label(controller.getSnapshot())).toBe("保存済み");
	});

	it("keeps editing during a slow save and sends the newer text afterward", async () => {
		const first = deferred<SaveResult>();
		const save =
			vi.fn<
				(input: { revision: number; value: Value }) => Promise<SaveResult>
			>();
		save.mockImplementationOnce(() => first.promise);
		save.mockImplementation(async (input) => ({
			revision: input.revision + 1,
			value: input.value,
		}));
		const controller = createController(save, { revision: 4 });

		controller.noteChange(document("first"));
		await vi.advanceTimersByTimeAsync(PAGE_AUTOSAVE_DELAY_MS);
		expect(save).toHaveBeenCalledTimes(1);
		expect(save.mock.calls[0]?.[0]?.revision).toBe(4);
		expect(label(controller.getSnapshot())).toBe("保存中");

		controller.noteChange(document("second"));
		controller.saveNow();
		await vi.advanceTimersByTimeAsync(PAGE_AUTOSAVE_DELAY_MS * 5);
		expect(save).toHaveBeenCalledTimes(1);
		expect(label(controller.getSnapshot())).toBe("保存中");
		expect(controller.getSnapshot().latestValue).toEqual(document("second"));

		first.resolve({ revision: 5, value: document("first") });
		await settle();

		expect(controller.getSnapshot().confirmedRevision).toBe(5);
		expect(controller.getSnapshot().latestValue).toEqual(document("second"));
		expect(label(controller.getSnapshot())).toBe("未保存");
		expect(save).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(PAGE_AUTOSAVE_DELAY_MS - 1);
		expect(save).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		await settle();

		expect(save).toHaveBeenCalledTimes(2);
		expect(save.mock.calls[1]?.[0]).toEqual({
			revision: 5,
			value: document("second"),
		});
		expect(controller.getSnapshot().confirmedRevision).toBe(6);
		expect(label(controller.getSnapshot())).toBe("保存済み");
	});

	it("stores the confirmed response revision and leaves a newer draft unsaved", async () => {
		const pending = deferred<SaveResult>();
		const save = vi.fn<
			(input: { revision: number; value: Value }) => Promise<SaveResult>
		>(() => pending.promise);
		const controller = createController(save);

		controller.noteChange(document("sent"));
		controller.saveNow();
		controller.noteChange(document("sent later"));
		pending.resolve({ revision: 1, value: document("sent") });
		await settle();

		expect(controller.getSnapshot().confirmedRevision).toBe(1);
		expect(controller.getSnapshot().latestValue).toEqual(
			document("sent later"),
		);
		expect(label(controller.getSnapshot())).toBe("未保存");
		expect(save.mock.calls[0]?.[0]?.value).toEqual(document("sent"));
	});

	it("keeps the draft after a network failure and retries only the latest text", async () => {
		const save =
			vi.fn<
				(input: { revision: number; value: Value }) => Promise<SaveResult>
			>();
		save.mockRejectedValueOnce(new Error("offline"));
		save.mockImplementation(async (input) => ({
			revision: input.revision + 1,
			value: input.value,
		}));
		const controller = createController(save, { revision: 2 });

		controller.noteChange(document("draft"));
		await vi.advanceTimersByTimeAsync(PAGE_AUTOSAVE_DELAY_MS);
		await settle();

		expect(save).toHaveBeenCalledTimes(1);
		expect(label(controller.getSnapshot())).toBe("保存できませんでした");
		expect(controller.getSnapshot().latestValue).toEqual(document("draft"));
		expect(controller.getSnapshot().confirmedRevision).toBe(2);

		controller.noteChange(document("draft revised"));
		await vi.advanceTimersByTimeAsync(PAGE_AUTOSAVE_DELAY_MS * 5);
		expect(save).toHaveBeenCalledTimes(1);
		expect(label(controller.getSnapshot())).toBe("保存できませんでした");

		controller.saveNow();
		await settle();

		expect(save).toHaveBeenCalledTimes(2);
		expect(save.mock.calls[1]?.[0]).toEqual({
			revision: 2,
			value: document("draft revised"),
		});
		expect(label(controller.getSnapshot())).toBe("保存済み");
		expect(controller.getSnapshot().confirmedRevision).toBe(3);
	});

	it("keeps the draft on conflict and does not save over the server revision", async () => {
		const save =
			vi.fn<
				(input: { revision: number; value: Value }) => Promise<SaveResult>
			>();
		save.mockRejectedValueOnce(new PageContentConflictError(8));
		const controller = createController(save);

		controller.noteChange(document("local"));
		await vi.advanceTimersByTimeAsync(PAGE_AUTOSAVE_DELAY_MS);
		await settle();

		expect(label(controller.getSnapshot())).toBe("別の場所で更新されています");
		expect(controller.getSnapshot().latestValue).toEqual(document("local"));
		expect(controller.getSnapshot().confirmedRevision).toBe(0);

		controller.noteChange(document("local still"));
		controller.saveNow();
		await vi.advanceTimersByTimeAsync(PAGE_AUTOSAVE_DELAY_MS * 5);
		expect(save).toHaveBeenCalledTimes(1);
		expect(controller.getSnapshot().latestValue).toEqual(
			document("local still"),
		);
		expect(label(controller.getSnapshot())).toBe("別の場所で更新されています");

		controller.setTarget({
			userId: "user-a",
			pageId: "page-a",
			value: document("server"),
			revision: 8,
		});
		expect(controller.getSnapshot().latestValue).toEqual(
			document("local still"),
		);
		expect(label(controller.getSnapshot())).toBe("別の場所で更新されています");
	});

	it("treats any HTTP 409 as a conflict and other statuses as save failures", async () => {
		const conflictSave = vi
			.fn()
			.mockRejectedValue(new HttpStatusError(409, "no"));
		const conflict = createController(conflictSave);
		conflict.noteChange(document("x"));
		conflict.saveNow();
		await settle();
		expect(label(conflict.getSnapshot())).toBe("別の場所で更新されています");

		const failedSave = vi
			.fn()
			.mockRejectedValue(new HttpStatusError(500, "no"));
		const failed = createController(failedSave);
		failed.noteChange(document("x"));
		failed.saveNow();
		await settle();
		expect(label(failed.getSnapshot())).toBe("保存できませんでした");
	});

	it("adopts a newer server document only while the page is already saved", () => {
		const save = vi.fn();
		const controller = createController(save, { text: "initial", revision: 1 });

		controller.setTarget({
			userId: "user-a",
			pageId: "page-a",
			value: document("fresh"),
			revision: 5,
		});
		expect(controller.getSnapshot().latestValue).toEqual(document("fresh"));
		expect(controller.getSnapshot().confirmedRevision).toBe(5);
		expect(controller.getSnapshot().generation).toBe(1);
		expect(label(controller.getSnapshot())).toBe("保存済み");

		controller.noteChange(document("dirty"));
		controller.setTarget({
			userId: "user-a",
			pageId: "page-a",
			value: document("ignored"),
			revision: 9,
		});
		expect(controller.getSnapshot().latestValue).toEqual(document("dirty"));
		expect(label(controller.getSnapshot())).toBe("未保存");
		expect(save).not.toHaveBeenCalled();
	});

	it("drops the previous page timer and ignores its late response", async () => {
		const pending = deferred<SaveResult>();
		const save = vi.fn<
			(input: { revision: number; value: Value }) => Promise<SaveResult>
		>(() => pending.promise);
		const controller = createController(save, { text: "a start" });

		controller.noteChange(document("secret a"));
		await vi.advanceTimersByTimeAsync(PAGE_AUTOSAVE_DELAY_MS);
		expect(save).toHaveBeenCalledTimes(1);
		expect(label(controller.getSnapshot())).toBe("保存中");

		controller.setTarget({
			userId: "user-b",
			pageId: "page-b",
			value: document("page b"),
			revision: 7,
		});
		pending.resolve({ revision: 1, value: document("secret a") });
		await settle();
		await vi.advanceTimersByTimeAsync(PAGE_AUTOSAVE_DELAY_MS * 2);

		expect(save).toHaveBeenCalledTimes(1);
		expect(controller.getSnapshot().latestValue).toEqual(document("page b"));
		expect(controller.getSnapshot().confirmedRevision).toBe(7);
		expect(label(controller.getSnapshot())).toBe("保存済み");
	});

	it("does not fire a pending timer after the page is left", async () => {
		const save = vi.fn();
		const controller = createController(save);
		controller.noteChange(document("pending leave"));
		expect(label(controller.getSnapshot())).toBe("未保存");

		controller.deactivate();
		await vi.advanceTimersByTimeAsync(PAGE_AUTOSAVE_DELAY_MS * 2);

		expect(save).not.toHaveBeenCalled();
		expect(controller.getSnapshot().latestValue).toEqual(
			document("pending leave"),
		);
	});

	it("saves immediately from the button and cancels the waiting timer", async () => {
		const save = vi.fn(async (input: { revision: number; value: Value }) => ({
			revision: input.revision + 1,
			value: input.value,
		}));
		const controller = createController(save);
		controller.noteChange(document("now"));
		await vi.advanceTimersByTimeAsync(400);
		controller.saveNow();
		await settle();
		await vi.advanceTimersByTimeAsync(PAGE_AUTOSAVE_DELAY_MS);

		expect(save).toHaveBeenCalledTimes(1);
		expect(save.mock.calls[0]?.[0]?.value).toEqual(document("now"));
		expect(label(controller.getSnapshot())).toBe("保存済み");
	});

	it("does not save while a discard confirmation is open", async () => {
		const save = vi.fn(async (input: { revision: number; value: Value }) => ({
			revision: input.revision + 1,
			value: input.value,
		}));
		const controller = createController(save);
		controller.noteChange(document("hold"));
		await vi.advanceTimersByTimeAsync(500);
		controller.suspend();
		await vi.advanceTimersByTimeAsync(PAGE_AUTOSAVE_DELAY_MS * 2);
		controller.noteChange(document("hold more"));
		await vi.advanceTimersByTimeAsync(PAGE_AUTOSAVE_DELAY_MS * 2);

		expect(save).not.toHaveBeenCalled();
		expect(label(controller.getSnapshot())).toBe("未保存");
		expect(controller.getSnapshot().latestValue).toEqual(document("hold more"));

		controller.resume();
		await vi.advanceTimersByTimeAsync(PAGE_AUTOSAVE_DELAY_MS - 1);
		expect(save).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		await settle();

		expect(save).toHaveBeenCalledTimes(1);
		expect(save.mock.calls[0]?.[0]?.value).toEqual(document("hold more"));
		expect(label(controller.getSnapshot())).toBe("保存済み");
	});

	it("does not start the follow-up save until discard confirmation closes", async () => {
		const pending = deferred<SaveResult>();
		const save = vi.fn((input: { revision: number; value: Value }) => {
			if (save.mock.calls.length === 1) return pending.promise;
			return Promise.resolve({
				revision: input.revision + 1,
				value: input.value,
			});
		});
		const controller = createController(save);
		controller.noteChange(document("first"));
		await vi.advanceTimersByTimeAsync(PAGE_AUTOSAVE_DELAY_MS);
		expect(save).toHaveBeenCalledTimes(1);

		controller.noteChange(document("second"));
		controller.suspend();
		pending.resolve({ revision: 1, value: document("first") });
		await settle();
		await vi.advanceTimersByTimeAsync(PAGE_AUTOSAVE_DELAY_MS * 2);

		expect(save).toHaveBeenCalledTimes(1);
		expect(label(controller.getSnapshot())).toBe("未保存");

		controller.resume();
		await vi.advanceTimersByTimeAsync(PAGE_AUTOSAVE_DELAY_MS);
		await settle();

		expect(save).toHaveBeenCalledTimes(2);
		expect(save.mock.calls[1]?.[0]).toEqual({
			revision: 1,
			value: document("second"),
		});
	});

	it("saves from the button while discard confirmation is open", async () => {
		const save = vi.fn(async (input: { revision: number; value: Value }) => ({
			revision: input.revision + 1,
			value: input.value,
		}));
		const controller = createController(save);
		controller.noteChange(document("manual"));
		controller.suspend();
		controller.saveNow();
		await settle();

		expect(save).toHaveBeenCalledTimes(1);
		expect(save.mock.calls[0]?.[0]?.value).toEqual(document("manual"));
	});

	it("replaces the draft when the server copy is loaded explicitly", () => {
		const save = vi.fn();
		const controller = createController(save);
		controller.noteChange(document("local"));
		controller.resetToServer(document("server copy"), 3);

		expect(controller.getSnapshot().latestValue).toEqual(
			document("server copy"),
		);
		expect(controller.getSnapshot().confirmedRevision).toBe(3);
		expect(label(controller.getSnapshot())).toBe("保存済み");
		expect(save).not.toHaveBeenCalled();
	});
});

function label(snapshot: PageAutosaveSnapshot): string {
	return pageAutosaveStatusLabel[snapshot.status];
}

describe("autosave lifecycle edge cases", () => {
	it("ignores detached edits and manual saves, and adopts normalized saved values", async () => {
		const save = vi.fn(async () => ({
			revision: 1,
			value: document("normalized"),
		}));
		const controller = createController(save);
		controller.deactivate();
		controller.noteChange(document("detached"));
		controller.saveNow();
		expect(save).not.toHaveBeenCalled();
		controller.activate();
		controller.saveNow();
		expect(save).not.toHaveBeenCalled();
		controller.noteChange(document("draft"));
		controller.saveNow();
		controller.saveNow();
		await Promise.resolve();
		expect(controller.getSnapshot().latestValue).toEqual(
			document("normalized"),
		);
		expect(save).toHaveBeenCalledTimes(1);
		controller.resume();
		controller.suspend();
		controller.resume();
		expect(controller.getSnapshot().status).toBe("saved");
	});
	it("does not resume a failed save or a detached pending draft", async () => {
		const save = vi.fn(async () => {
			throw new Error("offline");
		});
		const controller = createController(save);
		controller.noteChange(document("draft"));
		controller.saveNow();
		await Promise.resolve();
		controller.suspend();
		controller.resume();
		controller.saveNow();
		await Promise.resolve();
		controller.deactivate();
		controller.suspend();
		controller.resume();
		expect(save).toHaveBeenCalledTimes(2);
		expect(controller.getSnapshot().latestValue).toEqual(document("draft"));
	});
});
