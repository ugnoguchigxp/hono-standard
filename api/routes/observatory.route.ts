import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import {
	hostMetricsSchema,
	scenarioSchema,
} from "../../shared/schemas/observatory";
import {
	MOCK_SCENARIOS,
	type MockSignalSimulator,
	type StreamPacket,
} from "../modules/observatory/mock/simulator";

const scenarioRequestSchema = z.object({ scenario: scenarioSchema }).strict();
const MAX_SUBSCRIBERS = 32;
const MAX_PENDING_PACKETS = 64;
const HEARTBEAT_MS = 10_000;

export function createObservatoryRoute(deps: {
	simulator: MockSignalSimulator;
	nodeEnv: "development" | "test" | "production";
	heartbeatMs?: number;
}) {
	const route = new Hono();
	route.get("/mock/state", (c) => {
		c.header("Cache-Control", "no-store");
		return c.json(deps.simulator.snapshot());
	});
	route.get("/mock/scenarios", (c) => {
		c.header("Cache-Control", "no-store");
		return c.json({
			scenarios: MOCK_SCENARIOS,
			current: deps.simulator.currentScenario,
			editable: deps.nodeEnv !== "production",
		});
	});
	route.post("/mock/scenario", async (c) => {
		if (deps.nodeEnv === "production") return c.notFound();
		if (
			!/^application\/json(?:\s*;|$)/i.test(c.req.header("Content-Type") ?? "")
		)
			return c.json({ message: "Invalid scenario request" }, 400);
		if (Number(c.req.header("Content-Length")) > 1_024)
			return c.json({ message: "Invalid scenario request" }, 400);
		const raw = await c.req.text().catch(() => "");
		if (raw.length > 1_024)
			return c.json({ message: "Invalid scenario request" }, 400);
		let body: unknown;
		try {
			body = JSON.parse(raw);
		} catch {
			body = undefined;
		}
		const parsed = scenarioRequestSchema.safeParse(body);
		if (!parsed.success)
			return c.json({ message: "Invalid scenario request" }, 400);
		c.header("Cache-Control", "no-store");
		return c.json(deps.simulator.setScenario(parsed.data.scenario));
	});
	route.get("/mock/host", (c) => {
		c.header("Cache-Control", "no-store");
		return c.json({
			scenario: deps.simulator.currentScenario,
			metrics: deps.simulator.currentHostMetrics,
		});
	});
	route.post("/mock/host", async (c) => {
		if (deps.nodeEnv === "production") return c.notFound();
		if (
			!/^application\/json(?:\s*;|$)/i.test(c.req.header("Content-Type") ?? "")
		)
			return c.json({ message: "Invalid host request" }, 400);
		if (Number(c.req.header("Content-Length")) > 2_048)
			return c.json({ message: "Invalid host request" }, 400);
		const raw = await c.req.text().catch(() => "");
		if (raw.length > 2_048)
			return c.json({ message: "Invalid host request" }, 400);
		let body: unknown;
		try {
			body = JSON.parse(raw);
		} catch {
			body = undefined;
		}
		const parsed = hostMetricsSchema.safeParse(body);
		if (!parsed.success)
			return c.json({ message: "Invalid host request" }, 400);
		c.header("Cache-Control", "no-store");
		return c.json(deps.simulator.setHostMetrics(parsed.data));
	});
	route.delete("/mock/host", (c) => {
		if (deps.nodeEnv === "production") return c.notFound();
		c.header("Cache-Control", "no-store");
		return c.json(deps.simulator.resetHostMetrics());
	});
	route.get("/mock/stream", (c) => {
		if (deps.simulator.subscriberCount >= MAX_SUBSCRIBERS)
			return c.json({ message: "Too many stream subscribers" }, 503);
		return streamSSE(c, async (stream) => {
			const pending: StreamPacket[] = [];
			let heartbeat = false;
			let closed = false;
			let wake: (() => void) | null = null;
			const signal = () => {
				wake?.();
				wake = null;
			};
			let unsubscribe: (() => void) | undefined;
			unsubscribe = deps.simulator.subscribe((packet) => {
				if (closed) return;
				if (pending.length >= MAX_PENDING_PACKETS) {
					closed = true;
					unsubscribe?.();
					stream.abort();
					signal();
					return;
				}
				pending.push(packet);
				signal();
			});
			const timer = setInterval(() => {
				heartbeat = true;
				signal();
			}, deps.heartbeatMs ?? HEARTBEAT_MS);
			stream.onAbort(() => {
				closed = true;
				signal();
			});
			try {
				while (!closed && !stream.aborted) {
					if (!pending.length && !heartbeat)
						await new Promise<void>((resolve) => {
							wake = resolve;
						});
					if (closed || stream.aborted) break;
					for (const packet of pending.splice(0)) {
						await stream.writeSSE({
							id: packet.id,
							event: packet.event,
							data: JSON.stringify(packet.data),
						});
					}
					if (heartbeat) {
						heartbeat = false;
						await stream.writeSSE({
							event: "heartbeat",
							data: JSON.stringify({
								instanceId: deps.simulator.snapshot().instanceId,
							}),
						});
					}
				}
			} finally {
				closed = true;
				clearInterval(timer);
				unsubscribe?.();
			}
		});
	});
	return route;
}
