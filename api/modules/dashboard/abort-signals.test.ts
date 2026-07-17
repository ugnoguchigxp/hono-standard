import { describe, expect, it, vi } from "vitest";
import { abortReason, composeAbortSignals, getAbortKind, raceDashboardOperation, timeoutSignal } from "./abort-signals";

describe("dashboard abort signals", () => {
	it("composes and cleans listeners and reasons", () => {
		const controller = new AbortController();
		const composed = composeAbortSignals([controller.signal]);
		controller.abort(abortReason("panel-timeout"));
		expect(getAbortKind(composed.signal)).toBe("panel-timeout");
		composed.dispose();
		expect(getAbortKind(new AbortController().signal)).toBeUndefined();
		const already = new AbortController(); already.abort(new Error("already"));
		const precomposed = composeAbortSignals([already.signal]);
		expect(precomposed.signal.aborted).toBe(true);
		precomposed.dispose();
	});
	it("returns a deadline rejection and cleans timeout", async () => {
		vi.useFakeTimers();
		const promise = raceDashboardOperation(new Promise(() => undefined), { signal: new AbortController().signal, timeoutMs: 10 });
		const assertion = expect(promise).rejects.toBeDefined();
		await vi.advanceTimersByTimeAsync(10);
		await assertion;
		const timeout = timeoutSignal(10);
		timeout.dispose();
		vi.useRealTimers();
	});

	it("observes late settlement without reopening the caller race", async () => {
		const controller = new AbortController();
		let resolveActual: ((value: number) => void) | undefined;
		const actual = new Promise<number>((resolve) => { resolveActual = resolve; });
		const outcomes: string[] = [];
		const raced = raceDashboardOperation(actual, { signal: controller.signal, onLateSettlement: (outcome) => outcomes.push(outcome) });
		controller.abort(abortReason("request"));
		await expect(raced).rejects.toBeDefined();
		resolveActual?.(1);
		await Promise.resolve();
		expect(outcomes).toEqual(["fulfilled"]);
	});
});
