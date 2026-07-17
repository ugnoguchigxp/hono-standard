import { describe, expect, it } from "vitest";
import { DashboardExecutionLimitError, DashboardExecutionLimiter } from "./execution-limiter";

describe("DashboardExecutionLimiter", () => {
	it("queues work and releases slots exactly once", async () => {
		const limiter = new DashboardExecutionLimiter({ maxConcurrent: 1, queueTimeoutMs: 100, maxQueued: 64 });
		const first = await limiter.acquire(new AbortController().signal);
		const queued = limiter.acquire(new AbortController().signal);
		expect(limiter.activeCount).toBe(1);
		first();
		const second = await queued;
		expect(limiter.activeCount).toBe(1);
		second();
		second();
		expect(limiter.activeCount).toBe(0);
	});

	it("rejects a queued request after timeout or cancellation", async () => {
		const limiter = new DashboardExecutionLimiter({ maxConcurrent: 1, queueTimeoutMs: 5, maxQueued: 64 });
		const release = await limiter.acquire(new AbortController().signal);
		await expect(limiter.acquire(new AbortController().signal)).rejects.toBeInstanceOf(DashboardExecutionLimitError);
		release();
	});
	it("enforces queue length and removes an aborted waiter", async () => {
		const limiter = new DashboardExecutionLimiter({ maxConcurrent: 1, queueTimeoutMs: 1000, maxQueued: 1 });
		const release = await limiter.acquire(new AbortController().signal);
		const controller = new AbortController();
		const queued = limiter.acquire(controller.signal);
		expect(limiter.queuedCount).toBe(1);
		controller.abort();
		await expect(queued).rejects.toMatchObject({
			code: "REQUEST_CANCELLED",
		});
		expect(limiter.queuedCount).toBe(0);
		await expect(limiter.acquire(new AbortController().signal)).rejects.toBeInstanceOf(DashboardExecutionLimitError);
		release();
	});

	it("rejects invalid limiter configuration", () => {
		expect(() => new DashboardExecutionLimiter({ maxConcurrent: 0, queueTimeoutMs: 1, maxQueued: 1 })).toThrow();
		expect(() => new DashboardExecutionLimiter({ maxConcurrent: 1, queueTimeoutMs: 0, maxQueued: 1 })).toThrow();
		expect(() => new DashboardExecutionLimiter({ maxConcurrent: 1, queueTimeoutMs: 1, maxQueued: -1 })).toThrow();
	});
});
