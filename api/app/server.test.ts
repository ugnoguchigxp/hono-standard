import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "./env";
import type { AppDeps } from "./hono";

const {
	getAppRuntime,
	writeStructuredLog,
	createStructuredLogRecord,
	errorLogFields,
} = vi.hoisted(() => ({
	getAppRuntime: vi.fn(),
	writeStructuredLog: vi.fn(),
	createStructuredLogRecord: vi.fn(
		(level: string, event: string, fields: Record<string, unknown> = {}) => ({
			level,
			event,
			...fields,
		}),
	),
	errorLogFields: vi.fn((error: unknown) => ({
		errorMessage: error instanceof Error ? error.message : String(error),
	})),
}));

vi.mock("./hono", () => ({
	default: { fetch: vi.fn() },
	getAppRuntime,
}));

vi.mock("./structured-log", () => ({
	writeStructuredLog,
	createStructuredLogRecord,
	errorLogFields,
}));

const testEnv = {
	host: "127.0.0.1",
	port: 5173,
} as AppEnv;

describe("HTTP server bootstrap", () => {
	const unbindSignals: Array<() => void> = [];

	beforeEach(() => {
		getAppRuntime.mockReset();
		writeStructuredLog.mockReset();
		createStructuredLogRecord.mockClear();
		errorLogFields.mockClear();
	});

	afterEach(() => {
		for (const unbind of unbindSignals.splice(0)) {
			unbind();
		}
		vi.restoreAllMocks();
	});

	it("starts the server and logs the bound address", async () => {
		const { startHttpServer } = await import("./server");
		const stop = vi.fn();
		const serve = vi.fn().mockReturnValue({ port: 6010, stop });

		const server = startHttpServer(testEnv, serve);

		expect(serve).toHaveBeenCalledWith({
			fetch: expect.any(Function),
			hostname: "127.0.0.1",
			port: 5173,
		});
		expect(server.port).toBe(6010);
		expect(createStructuredLogRecord).toHaveBeenCalledWith(
			"info",
			"server_started",
			{ host: "127.0.0.1", port: 6010 },
		);
	});

	it("drains in-flight requests before closing the database and deduplicates shutdown", async () => {
		const { shutdownHttpServer } = await import("./server");
		let drain: () => void = () => {};
		const stop = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					drain = resolve;
				}),
		);
		const close = vi.fn();
		const exit = vi.fn();
		getAppRuntime.mockResolvedValue({ dbRuntime: { close } });
		const server = { port: 1, stop };
		const pending = shutdownHttpServer(server, "SIGTERM", { exit });
		expect(shutdownHttpServer(server, "SIGINT", { exit })).toBe(pending);
		expect(close).not.toHaveBeenCalled();
		expect(exit).not.toHaveBeenCalled();
		drain();
		await pending;
		expect(stop).toHaveBeenCalledExactlyOnceWith(false);
		expect(close).toHaveBeenCalledOnce();
		expect(exit).toHaveBeenCalledExactlyOnceWith(0);
	});

	it.each([
		"request",
		"database",
	])("forces shutdown when the %s exceeds the deadline", async (phase) => {
		const { shutdownHttpServer } = await import("./server");
		const hanging = new Promise<void>(() => {});
		const stop = vi.fn((force?: boolean) =>
			phase === "request" && !force ? hanging : Promise.resolve(),
		);
		const close = vi.fn(() =>
			phase === "database" ? hanging : Promise.resolve(),
		);
		const exit = vi.fn();
		getAppRuntime.mockResolvedValue({ dbRuntime: { close } });
		await shutdownHttpServer({ port: 1, stop }, "SIGTERM", {
			exit,
			timeoutMs: 5,
		});
		expect(stop.mock.calls).toEqual([[false], [true]]);
		expect(exit).toHaveBeenCalledExactlyOnceWith(1);
	});

	it.each([
		false,
		true,
	])("exits even if force-close fails (async: %s)", async (asynchronous) => {
		const { shutdownHttpServer } = await import("./server");
		const stop = vi.fn(() => {
			if (asynchronous) return Promise.reject(new Error("stop failed"));
			throw new Error("stop failed");
		});
		const exit = vi.fn();
		await shutdownHttpServer({ port: 1, stop }, "SIGTERM", { exit });
		expect(stop).toHaveBeenCalledTimes(2);
		expect(exit).toHaveBeenCalledExactlyOnceWith(1);
	});

	it("uses the bound port when present and otherwise the requested port", async () => {
		const { toHttpServer } = await import("./server");
		const stop = vi.fn();

		expect(toHttpServer({ port: 6010, stop }, 5173).port).toBe(6010);
		const fallback = toHttpServer({ stop }, 5173);
		expect(fallback.port).toBe(5173);
		fallback.stop(false);
		expect(stop).toHaveBeenCalledWith(false);
	});

	it("closes the runtime and exits successfully on shutdown", async () => {
		const { shutdownHttpServer } = await import("./server");
		const stop = vi.fn();
		const close = vi.fn();
		const exit = vi.fn();
		getAppRuntime.mockResolvedValue({
			dbRuntime: { close },
		} as unknown as AppDeps);

		await shutdownHttpServer({ port: 5173, stop }, "SIGINT", {
			exit,
		});

		expect(stop).toHaveBeenCalledWith(false);
		expect(close).toHaveBeenCalled();
		expect(exit).toHaveBeenCalledWith(0);
		expect(createStructuredLogRecord).toHaveBeenCalledWith(
			"info",
			"server_stopped",
			{ signal: "SIGINT" },
		);
	});

	it("exits with an error when shutdown fails", async () => {
		const { shutdownHttpServer } = await import("./server");
		const stop = vi.fn();
		const exit = vi.fn();
		getAppRuntime.mockRejectedValue(new Error("close failed"));

		await shutdownHttpServer({ port: 5173, stop }, "SIGTERM", {
			exit,
		});

		expect(exit).toHaveBeenCalledWith(1);
		expect(createStructuredLogRecord).toHaveBeenCalledWith(
			"error",
			"server_shutdown_failed",
			expect.objectContaining({ signal: "SIGTERM" }),
		);
	});

	it("uses process.exit when shutdown deps are omitted", async () => {
		const { shutdownHttpServer } = await import("./server");
		const stop = vi.fn();
		const close = vi.fn();
		const exit = vi
			.spyOn(process, "exit")
			.mockImplementation(() => undefined as never);
		getAppRuntime.mockResolvedValue({
			dbRuntime: { close },
		} as unknown as AppDeps);

		try {
			await shutdownHttpServer({ port: 5173, stop }, "SIGINT");
			expect(close).toHaveBeenCalled();
			expect(exit).toHaveBeenCalledWith(0);
		} finally {
			exit.mockRestore();
		}
	});

	it("binds SIGINT and SIGTERM to the shutdown handler", async () => {
		const { bindHttpServerSignals } = await import("./server");
		const onShutdown = vi.fn().mockResolvedValue(undefined);

		const unbind = bindHttpServerSignals(
			{ port: 1, stop: vi.fn() },
			onShutdown,
		);
		unbindSignals.push(unbind);

		process.emit("SIGINT");
		process.emit("SIGTERM");
		expect(onShutdown).toHaveBeenCalledWith("SIGINT");
		expect(onShutdown).toHaveBeenCalledTimes(1);
	});

	it("shuts down through the default signal handler", async () => {
		const { bindHttpServerSignals } = await import("./server");
		const stop = vi.fn();
		const close = vi.fn();
		const exit = vi
			.spyOn(process, "exit")
			.mockImplementation(() => undefined as never);
		getAppRuntime.mockResolvedValue({
			dbRuntime: { close },
		} as unknown as AppDeps);

		try {
			unbindSignals.push(bindHttpServerSignals({ port: 1, stop }));
			process.emit("SIGINT");
			await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
			expect(stop).toHaveBeenCalledWith(false);
		} finally {
			exit.mockRestore();
		}
	});
});
