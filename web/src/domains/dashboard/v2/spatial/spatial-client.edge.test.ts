import { MockSignalSimulator } from "@api/modules/observatory/mock/simulator";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	abortableDelay,
	ObservatoryHttpError,
	runObservatorySession,
} from "./spatial-client";

const instanceId = "00000000-0000-4000-8000-000000000001";
const snapshot = new MockSignalSimulator({
	seed: 42,
	initialTime: 1_700_000_000_000,
	instanceId,
}).snapshot();
const encoder = new TextEncoder();
const frame = (event: string, id: string | undefined, data: unknown) =>
	`event: ${event}\n${id ? `id: ${id}\n` : ""}data: ${JSON.stringify(data)}\n\n`;

const stream = (chunks: string[], keepOpen = false) =>
	new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
			if (!keepOpen) controller.close();
		},
	});

const fetcherFor =
	(streamResponse: () => Response) => async (path: RequestInfo | URL) =>
		String(path).endsWith("/state")
			? new Response(JSON.stringify(snapshot), { status: 200 })
			: streamResponse();

const run = (
	fetcher: (path: RequestInfo | URL) => Promise<Response>,
	extra: { signal?: AbortSignal; readTimeoutMs?: number } = {},
) =>
	runObservatorySession({
		signal: extra.signal ?? new AbortController().signal,
		readTimeoutMs: extra.readTimeoutMs,
		fetcher: fetcher as never,
		onData: () => undefined,
		onLive: () => undefined,
	});

const sse = (body: ReadableStream<Uint8Array> | null) =>
	new Response(body, {
		status: 200,
		headers: { "Content-Type": "text/event-stream" },
	});

afterEach(() => vi.useRealTimers());

describe("observatory session failures", () => {
	it("rejects a failing stream request", async () => {
		await expect(
			run(fetcherFor(() => new Response(null, { status: 503 }))),
		).rejects.toBeInstanceOf(ObservatoryHttpError);
	});

	it("rejects responses that are not event streams", async () => {
		await expect(
			run(fetcherFor(() => new Response("{}", { status: 200 }))),
		).rejects.toThrow("Invalid observatory stream response");
	});

	it("rejects a closed stream after skipping heartbeats", async () => {
		await expect(
			run(
				fetcherFor(() =>
					sse(
						stream([
							frame("snapshot", `${instanceId}:0`, snapshot),
							frame("heartbeat", undefined, { instanceId }),
							frame("snapshot", `${instanceId}:0`, snapshot),
						]),
					),
				),
			),
		).rejects.toThrow("Observatory stream closed");
	});

	it("times out when the stream stops sending data", async () => {
		await expect(
			run(fetcherFor(() => sse(stream([], true))), { readTimeoutMs: 5 }),
		).rejects.toThrow("heartbeat timed out");
	});

	it("aborts immediately when the caller signal is already aborted", async () => {
		const controller = new AbortController();
		controller.abort();
		const fetcher = vi.fn(
			async (_path: RequestInfo | URL, init?: RequestInit) => {
				expect(init?.signal?.aborted).toBe(true);
				throw new DOMException("aborted", "AbortError");
			},
		);
		await expect(run(fetcher, { signal: controller.signal })).rejects.toThrow(
			"aborted",
		);
	});
});

describe("abortableDelay", () => {
	it("resolves after the delay or on abort", async () => {
		vi.useFakeTimers();
		const timed = abortableDelay(100, new AbortController().signal);
		await vi.advanceTimersByTimeAsync(100);
		await expect(timed).resolves.toBeUndefined();

		const controller = new AbortController();
		const aborted = abortableDelay(10_000, controller.signal);
		controller.abort();
		await expect(aborted).resolves.toBeUndefined();

		await expect(abortableDelay(10_000, controller.signal)).resolves.toBe(
			undefined,
		);
	});
});
