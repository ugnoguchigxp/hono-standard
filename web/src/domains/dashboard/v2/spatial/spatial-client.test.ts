import { describe, expect, it } from "vitest";
import { MockSignalSimulator } from "@api/modules/observatory/mock/simulator";
import { ObservatoryHttpError, runObservatorySession } from "./spatial-client";

const createEngine = () => new MockSignalSimulator({ seed: 42, initialTime: 1_700_000_000_000, instanceId: "00000000-0000-4000-8000-000000000001" });

describe("observatory session", () => {
	it("loads REST state, accepts stream snapshot, and applies live updates", async () => {
		const engine = createEngine();
		const packets: Array<{ id: string; event: string; data: unknown }> = [];
		engine.subscribe((packet) => packets.push(packet));
		const restSnapshot = engine.snapshot();
		engine.advance();
		const encoder = new TextEncoder();
		const streamBody = new ReadableStream<Uint8Array>({
			start(controller) {
				const text = packets.map((packet) => `event: ${packet.event}\nid: ${packet.id}\ndata: ${JSON.stringify(packet.data)}\n\n`).join("");
				controller.enqueue(encoder.encode(text.slice(0, 45)));
				controller.enqueue(encoder.encode(text.slice(45)));
			},
		});
		const requests: string[] = [];
		const fetcher = async (path: RequestInfo | URL) => {
			requests.push(String(path));
			return requests.length === 1
				? new Response(JSON.stringify(restSnapshot), { status: 200 })
				: new Response(streamBody, { status: 200, headers: { "Content-Type": "text/event-stream" } });
		};
		const controller = new AbortController();
		let live = false;
		const ticks: number[] = [];
		await runObservatorySession({
			signal: controller.signal,
			fetcher,
			onLive: () => { live = true; },
			onData: (data) => {
				ticks.push(data.snapshot.tick);
				if (data.snapshot.tick === 1) controller.abort();
			},
		});
		expect(requests).toEqual(["/api/observatory/mock/state", "/api/observatory/mock/stream"]);
		expect(live).toBe(true);
		expect(ticks).toContain(1);
	});

	it("stops on an unauthorized snapshot response", async () => {
		await expect(runObservatorySession({
			signal: new AbortController().signal,
			fetcher: async () => new Response(null, { status: 401 }),
			onData: () => undefined,
			onLive: () => undefined,
		})).rejects.toMatchObject({ status: 401 } satisfies Partial<ObservatoryHttpError>);
	});
});
