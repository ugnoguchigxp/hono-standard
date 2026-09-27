import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { MockSignalSimulator } from "../modules/observatory/mock/simulator";
import { createObservatoryRoute } from "./observatory.route";

const options = { seed: 42, initialTime: 1_700_000_000_000, instanceId: "00000000-0000-4000-8000-000000000001" };
const createRoute = (nodeEnv: "test" | "production" = "test", heartbeatMs?: number) => {
	const simulator = new MockSignalSimulator(options);
	const app = new Hono();
	app.route("/", createObservatoryRoute({ simulator, nodeEnv, heartbeatMs }));
	return { app, simulator };
};

describe("observatory mock route", () => {
	it("serves a current snapshot and allowed scenarios", async () => {
		const { app, simulator } = createRoute();
		const state = await app.request("/mock/state");
		expect(state.status).toBe(200);
		expect(state.headers.get("Cache-Control")).toBe("no-store");
		expect((await state.json()).tick).toBe(0);
		simulator.advance();
		expect((await (await app.request("/mock/state")).json()).tick).toBe(1);
		const scenarios = await (await app.request("/mock/scenarios")).json();
		expect(scenarios.scenarios).toHaveLength(6);
	});

	it("validates scenario commands and disables them in production", async () => {
		const { app } = createRoute();
		const post = (body: string, contentType = "application/json") => app.request("/mock/scenario", { method: "POST", headers: { "Content-Type": contentType }, body });
		expect((await post("{" )).status).toBe(400);
		expect((await post(JSON.stringify({ scenario: "pipeline-stalled" }))).status).toBe(400);
		expect((await post(JSON.stringify({ scenario: "normal", extra: "x".repeat(1_100) }))).status).toBe(400);
		expect((await post(JSON.stringify({ scenario: "normal" }), "text/plain")).status).toBe(400);
		const changed = await post(JSON.stringify({ scenario: "runtime-degraded" }));
		expect(changed.status).toBe(200);
		expect((await changed.json()).scenario).toBe("runtime-degraded");
		const production = createRoute("production");
		expect((await production.app.request("/mock/scenario", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenario: "normal" }) })).status).toBe(404);
	});

	it("streams a snapshot and ordered updates, then releases the subscriber", async () => {
		const { app, simulator } = createRoute();
		const response = await app.request("/mock/stream");
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain("text/event-stream");
		const reader = response.body?.getReader();
		if (!reader) throw new Error("Missing stream body");
		const first = new TextDecoder().decode((await reader.read()).value);
		expect(first).toContain("event: snapshot");
		expect(first).toContain("id: 00000000-0000-4000-8000-000000000001:0");
		simulator.advance();
		let updates = "";
		while (!updates.includes("event: snapshot")) updates += new TextDecoder().decode((await reader.read()).value);
		expect(updates).toContain("event: telemetry");
		expect(updates).toContain("event: event");
		expect(updates).toContain('"tick":1');
		await reader.cancel();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(simulator.subscriberCount).toBe(0);
	});

	it("starts a new stream with a complete snapshot after a disconnect", async () => {
		const { app, simulator } = createRoute();
		const response = await app.request("/mock/stream");
		const reader = response.body?.getReader();
		await reader?.read();
		await reader?.cancel();
		simulator.advance(3);
		const reconnected = await app.request("/mock/stream");
		const secondReader = reconnected.body?.getReader();
		const first = new TextDecoder().decode((await secondReader?.read())?.value);
		expect(first).toContain('"tick":3');
		await secondReader?.cancel();
	});

	it("sends transport heartbeats without advancing entity freshness", async () => {
		const { app, simulator } = createRoute("test", 5);
		const response = await app.request("/mock/stream");
		const reader = response.body?.getReader();
		if (!reader) throw new Error("Missing stream body");
		await reader.read();
		const heartbeat = new TextDecoder().decode((await reader.read()).value);
		expect(heartbeat).toContain("event: heartbeat");
		expect(simulator.snapshot().tick).toBe(0);
		await reader.cancel();
	});

	it("limits concurrent stream subscriptions", async () => {
		const { app, simulator } = createRoute();
		const unsubscribers = Array.from({ length: 32 }, () => simulator.subscribe(() => undefined));
		const response = await app.request("/mock/stream");
		expect(response.status).toBe(503);
		for (const unsubscribe of unsubscribers) unsubscribe();
		expect(simulator.subscriberCount).toBe(0);
	});

	it("drops a slow subscriber when its pending queue exceeds the bound", async () => {
		const { app, simulator } = createRoute();
		const response = await app.request("/mock/stream");
		const reader = response.body?.getReader();
		if (!reader) throw new Error("Missing stream body");
		await reader.read();
		simulator.advance(70);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(simulator.subscriberCount).toBe(0);
		await reader.cancel().catch(() => undefined);
	});
});
