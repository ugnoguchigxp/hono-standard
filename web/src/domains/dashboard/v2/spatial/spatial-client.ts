import { appFetch } from "../../../../api";
import { snapshotSchema } from "@shared/schemas/observatory";
import { applySseRecord, type SpatialData } from "./spatial-state";
import { SseParser } from "./stream-parser";

export class ObservatoryHttpError extends Error {
	constructor(readonly status: number) {
		super(`Observatory request failed (${status})`);
	}
}

export async function runObservatorySession(input: {
	signal: AbortSignal;
	onData: (data: SpatialData) => void;
	onLive: () => void;
	fetcher?: typeof appFetch;
	readTimeoutMs?: number;
}) {
	const fetcher = input.fetcher ?? appFetch;
	const controller = new AbortController();
	const abort = () => controller.abort();
	input.signal.addEventListener("abort", abort, { once: true });
	if (input.signal.aborted) controller.abort();
	let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
	try {
		const stateResponse = await fetcher("/api/observatory/mock/state", {
			signal: controller.signal,
		});
		if (!stateResponse.ok) throw new ObservatoryHttpError(stateResponse.status);
		const snapshot = snapshotSchema.parse(await stateResponse.json());
		let data: SpatialData = { snapshot, events: [], lastSequence: -1 };
		input.onData(data);
		const response = await fetcher("/api/observatory/mock/stream", {
			signal: controller.signal,
		});
		if (!response.ok) throw new ObservatoryHttpError(response.status);
		if (
			!response.headers.get("Content-Type")?.includes("text/event-stream") ||
			!response.body
		)
			throw new Error("Invalid observatory stream response");
		reader = response.body.getReader();
		const decoder = new TextDecoder();
		const parser = new SseParser();
		let initial = true;
		while (!controller.signal.aborted) {
			const { done, value } = await readWithTimeout(
				reader,
				input.readTimeoutMs ?? 25_000,
				controller,
			);
			if (done) throw new Error("Observatory stream closed");
			for (const record of parser.feed(
				decoder.decode(value, { stream: true }),
			)) {
				const next = applySseRecord(data, record, initial);
				if (record.event === "heartbeat") continue;
				if (!next) throw new Error("Missing observatory state");
				if (initial) {
					initial = false;
					input.onLive();
				}
				if (next !== data) {
					data = next;
					input.onData(data);
				}
			}
		}
	} finally {
		controller.abort();
		input.signal.removeEventListener("abort", abort);
		void reader?.cancel().catch(() => undefined);
	}
}

async function readWithTimeout(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	timeoutMs: number,
	controller: AbortController,
) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			reader.read(),
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => {
					controller.abort();
					reject(new Error("Observatory stream heartbeat timed out"));
				}, timeoutMs);
			}),
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

export function abortableDelay(ms: number, signal: AbortSignal) {
	return new Promise<void>((resolve) => {
		if (signal.aborted) return resolve();
		const timer = setTimeout(done, ms);
		function done() {
			clearTimeout(timer);
			signal.removeEventListener("abort", done);
			resolve();
		}
		signal.addEventListener("abort", done, { once: true });
	});
}
