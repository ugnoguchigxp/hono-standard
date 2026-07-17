import { describe, expect, it } from "vitest";
import { demoDashboard } from "./demo-dashboard";
import { createDashboardModule } from "./index";
import { createDashboardQueryExecutor } from "./query-executor";

describe("dashboard query executor", () => {
	it("resolves the range once and returns the shared response envelope", async () => {
		const now = new Date("2026-07-16T01:00:00.000Z");
		let nowCalls = 0;
		const module = createDashboardModule({ now: () => { nowCalls += 1; return now; } });
		const executor = createDashboardQueryExecutor(module);
		const response = await executor.query("operations", "request-rate", { range: { kind: "relative", value: "15m" }, timezone: "UTC", filters: { service: ["api"] }, maxDataPoints: 10 }, new AbortController().signal);
		expect(response.requestId).toMatch(/[0-9a-f-]{36}/);
		expect(response.resolvedRange.to).toBe(now.toISOString());
		expect(response.data.kind).toBe("timeseries");
		expect(nowCalls).toBeGreaterThanOrEqual(1);
	});

	it("returns typed errors for unknown resources and invalid requests", async () => {
		const executor = createDashboardQueryExecutor(createDashboardModule());
		await expect(executor.query("missing", "request-rate", {}, new AbortController().signal)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
		await expect(executor.query("operations", "missing", { range: { kind: "relative", value: "1h" }, timezone: "UTC" }, new AbortController().signal)).rejects.toMatchObject({ code: "PANEL_NOT_FOUND" });
	});

	it("maps handler timeout and request cancellation to A8 error codes", async () => {
		const dashboards = [{ ...demoDashboard, panels: demoDashboard.panels.map((panel) => panel.manifest.id === "request-rate" ? { ...panel, handler: ({ signal }: { signal: AbortSignal }) => new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })) } : panel) }];
		const module = createDashboardModule({ dashboards, limits: { handlerTimeoutMs: 5 } });
		const executor = createDashboardQueryExecutor(module);
		await expect(executor.query("operations", "request-rate", { range: { kind: "relative", value: "15m" }, timezone: "UTC" }, new AbortController().signal)).rejects.toMatchObject({ code: "HANDLER_TIMEOUT", retryable: true });
		const controller = new AbortController();
		const promise = executor.query("operations", "request-rate", { range: { kind: "relative", value: "15m" }, timezone: "UTC" }, controller.signal);
		controller.abort();
		await expect(promise).rejects.toMatchObject({ code: "REQUEST_CANCELLED", retryable: false });
	});

	it("maps a signal aborted before limiter acquisition to request cancellation", async () => {
		const executor = createDashboardQueryExecutor(createDashboardModule());
		const controller = new AbortController();
		controller.abort(new Error("client disconnected"));
		await expect(
			executor.query(
				"operations",
				"request-rate",
				{
					range: { kind: "relative", value: "15m" },
					timezone: "UTC",
				},
				controller.signal,
			),
		).rejects.toMatchObject({ code: "REQUEST_CANCELLED", retryable: false });
	});

	it("returns on timeout even when a handler ignores cancellation", async () => {
		const dashboards = [{ ...demoDashboard, panels: demoDashboard.panels.map((panel) => panel.manifest.id === "request-rate" ? { ...panel, handler: () => new Promise<never>(() => undefined) } : panel) }];
		const module = createDashboardModule({ dashboards, limits: { handlerTimeoutMs: 5 } });
		const executor = createDashboardQueryExecutor(module);
		await expect(executor.query("operations", "request-rate", { range: { kind: "relative", value: "15m" }, timezone: "UTC" }, new AbortController().signal)).rejects.toMatchObject({ code: "HANDLER_TIMEOUT" });
	});

	it("releases the limiter after a synchronous handler failure", async () => {
		const dashboards = [{ ...demoDashboard, panels: demoDashboard.panels.map((panel) => panel.manifest.id === "request-rate" ? { ...panel, handler: () => { throw new Error("secret"); } } : panel) }];
		const module = createDashboardModule({ dashboards, limits: { maxConcurrent: 1 } });
		const executor = createDashboardQueryExecutor(module);
		await expect(executor.query("operations", "request-rate", { range: { kind: "relative", value: "15m" }, timezone: "UTC" }, new AbortController().signal)).rejects.toMatchObject({ code: "QUERY_FAILED", message: "Dashboard query failed" });
		expect(module.limiter.activeCount).toBe(0);
	});

	it("does not count queue wait time toward the handler timeout", async () => {
		const module = createDashboardModule({ limits: { maxConcurrent: 1, queueTimeoutMs: 200, handlerTimeoutMs: 30, panelTimeoutMs: 100, serverTransformationBudgetMs: 10 } });
		const release = await module.limiter.acquire(new AbortController().signal);
		const executor = createDashboardQueryExecutor(module);
		const result = executor.query("operations", "error-ratio", { range: { kind: "relative", value: "15m" }, timezone: "UTC" }, new AbortController().signal);
		await new Promise((resolve) => setTimeout(resolve, 50));
		release();
		await expect(result).resolves.toMatchObject({ data: { kind: "stat" } });
	});
});
