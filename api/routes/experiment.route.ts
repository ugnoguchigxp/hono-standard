import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
	createExperimentSchema,
	controlSchema,
} from "../../shared/schemas/experiment.schema";
import type { BrainSandboxService } from "../modules/brain-sandbox/service";
import { getAuthContextUser } from "../modules/auth/context";
export function createExperimentRoute(service: BrainSandboxService) {
	return new Hono()
		.post("/", zValidator("json", createExperimentSchema), async (c) => {
			const input = c.req.valid("json");
			return c.json(
				await service.create(
					getAuthContextUser(c).userId,
					input.seed,
					input.configOverrides,
					input.scenario,
				),
				201,
			);
		})
		.get("/", async (c) =>
			c.json({ items: await service.list(getAuthContextUser(c).userId) }),
		)
		.get("/:id/snapshot", async (c) =>
			c.json(
				await service.snapshot(c.req.param("id"), getAuthContextUser(c).userId),
			),
		)
		.get("/:id", async (c) =>
			c.json(
				await service.snapshot(c.req.param("id"), getAuthContextUser(c).userId),
			),
		)
		.get("/:id/export", (c) =>
			c.json(service.export(c.req.param("id"), getAuthContextUser(c).userId)),
		)
		.get("/:id/neurons/:neuronId", (c) =>
			c.json(
				service.neuron(
					c.req.param("id"),
					Number(c.req.param("neuronId")),
					getAuthContextUser(c).userId,
				),
			),
		)
		.get("/:id/synapses/:synapseId", (c) =>
			c.json(
				service.synapse(
					c.req.param("id"),
					Number(c.req.param("synapseId")),
					getAuthContextUser(c).userId,
				),
			),
		)
		.get("/:id/events", async (c) => {
			const ownerId = getAuthContextUser(c).userId;
			const runId = c.req.param("id");
			const snapshot = await service.snapshot(runId, ownerId);
			try {
				return new Response(service.stream.stream(runId, ownerId, snapshot), {
					headers: {
						"Cache-Control": "no-cache",
						Connection: "keep-alive",
						"Content-Type": "text/event-stream; charset=utf-8",
					},
				});
			} catch (error) {
				if (error instanceof Error && error.message === "subscriber_limit")
					return c.json({ message: "Subscriber limit reached" }, 429);
				throw error;
			}
		})
		.post("/:id/control", zValidator("json", controlSchema), async (c) =>
			c.json(
				await service.control(
					c.req.param("id"),
					getAuthContextUser(c).userId,
					c.req.valid("json"),
				),
			),
		);
}
