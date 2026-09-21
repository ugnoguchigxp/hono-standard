import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../app/http-error";
import { createExperimentRoute } from "./experiment.route";

const owner = {
	userId: "owner",
	email: "owner@example.com",
	role: "member" as const,
};
function makeApp(service: Record<string, unknown>) {
	const app = new Hono();
	app.use("*", async (c, next) => {
		c.set("authUser", owner);
		await next();
	});
	app.onError((error, c) =>
		c.json(
			{ message: error.message },
			(error instanceof HttpError ? error.status : 500) as ContentfulStatusCode,
		),
	);
	app.route("/experiments", createExperimentRoute(service as never));
	return app;
}

describe("experiment routes", () => {
	it("validates and delegates the complete HTTP surface to the owner service", async () => {
		const stream = new ReadableStream();
		const service = {
			create: vi.fn().mockResolvedValue({ runId: "r", status: "paused" }),
			list: vi.fn().mockResolvedValue([{ runId: "r" }]),
			snapshot: vi.fn().mockResolvedValue({ runId: "r", status: "paused" }),
			export: vi.fn().mockReturnValue({ runId: "r", schemaVersion: 1 }),
			neuron: vi.fn().mockReturnValue({ neuron: { id: 2 } }),
			synapse: vi.fn().mockReturnValue({ synapse: { id: 3 } }),
			control: vi.fn().mockResolvedValue({ runId: "r", revision: 1 }),
			stream: { stream: vi.fn().mockReturnValue(stream) },
		};
		const app = makeApp(service);
		const create = await app.request("/experiments", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ seed: 2, scenario: "risk", configOverrides: {} }),
		});
		expect(create.status).toBe(201);
		expect(service.create).toHaveBeenCalledWith(owner.userId, 2, {}, "risk");
		expect((await app.request("/experiments")).status).toBe(200);
		expect((await app.request("/experiments/r")).status).toBe(200);
		expect((await app.request("/experiments/r/snapshot")).status).toBe(200);
		expect((await app.request("/experiments/r/export")).status).toBe(200);
		expect((await app.request("/experiments/r/neurons/2")).status).toBe(200);
		expect((await app.request("/experiments/r/synapses/3")).status).toBe(200);
		const events = await app.request("/experiments/r/events");
		expect(events.headers.get("Content-Type")).toContain("text/event-stream");
		const control = await app.request("/experiments/r/control", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				commandId: "c",
				expectedRevision: 0,
				action: "run",
			}),
		});
		expect(control.status).toBe(200);
		expect(service.control).toHaveBeenCalledWith(
			"r",
			owner.userId,
			expect.objectContaining({ action: "run" }),
		);
	});

	it("returns validation and subscriber-limit errors", async () => {
		const service = {
			create: vi.fn(),
			list: vi.fn(),
			snapshot: vi.fn().mockResolvedValue({}),
			export: vi.fn(),
			neuron: vi.fn(),
			synapse: vi.fn(),
			control: vi.fn(),
			stream: {
				stream: vi.fn(() => {
					throw new Error("subscriber_limit");
				}),
			},
		};
		const app = makeApp(service);
		expect(
			(
				await app.request("/experiments", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ seed: -1 }),
				})
			).status,
		).toBe(400);
		expect(
			(
				await app.request("/experiments/r/control", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						commandId: "c",
						expectedRevision: -1,
						action: "run",
					}),
				})
			).status,
		).toBe(400);
		expect((await app.request("/experiments/r/events")).status).toBe(429);
	});
});
