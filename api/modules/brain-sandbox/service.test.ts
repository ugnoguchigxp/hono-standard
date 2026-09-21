import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { BrainSandboxService } from "./service";

describe("BrainSandboxService", () => {
	it("enforces ownership, revision, and idempotent controls", async () => {
		const service = new BrainSandboxService();
		const run = await service.create("alice", 1);
		await expect(service.snapshot(run.runId, "bob")).rejects.toThrow(
			/not found/i,
		);
		const command = {
			commandId: "step-1",
			expectedRevision: 0,
			action: "step" as const,
		};
		const result = (await service.control(run.runId, "alice", command)) as {
			revision: number;
			simTimeMs: number;
		};
		expect(result.simTimeMs).toBe(100);
		expect(await service.control(run.runId, "alice", command)).toEqual(result);
		await expect(
			service.control(run.runId, "alice", {
				...command,
				commandId: "stale",
				expectedRevision: 0,
			}),
		).rejects.toThrow(/revision/i);
	});
	it("exports and inspects owned network data", async () => {
		const service = new BrainSandboxService();
		const run = await service.create("alice", 2);
		const exported = service.export(run.runId, "alice");
		expect(exported.runId).toBe(run.runId);
		const neuron = service.neuron(run.runId, 0, "alice");
		expect(neuron.neuron.id).toBe(0);
		const synapseId = neuron.outgoing[0]?.id;
		if (synapseId)
			expect(service.synapse(run.runId, synapseId, "alice").synapse.id).toBe(
				synapseId,
			);
	});
	it("limits simultaneous runs across owners", async () => {
		const service = new BrainSandboxService();
		for (const ownerId of ["a", "b", "c", "d"])
			await service.create(ownerId, 1);
		await expect(service.create("e", 1)).rejects.toThrow(/capacity/i);
	});
	it("persists lifecycle controls, reset, and scheduler progress", async () => {
		const persistence = {
			create: vi.fn(),
			update: vi.fn(),
			saveCommand: vi.fn(),
			saveCheckpoint: vi.fn(),
			list: vi.fn().mockResolvedValue([]),
			find: vi.fn(),
			findCommand: vi.fn(),
		};
		const service = new BrainSandboxService(persistence as never);
		const first = await service.create("alice", 7);
		const running = (await service.control(first.runId, "alice", {
			commandId: "run",
			expectedRevision: 0,
			action: "run",
			speed: 10,
		})) as { revision: number; status: string };
		expect(running).toMatchObject({ revision: 1, status: "running" });
		await service.tick();
		expect(
			(await service.snapshot(first.runId, "alice")) as { simTimeMs: number },
		).toMatchObject({ simTimeMs: 1000 });
		const paused = await service.control(first.runId, "alice", {
			commandId: "pause",
			expectedRevision: 1,
			action: "pause",
		});
		expect(paused).toMatchObject({ status: "paused", revision: 2 });
		const reset = (await service.control(first.runId, "alice", {
			commandId: "reset",
			expectedRevision: 2,
			action: "reset",
		})) as { runId: string; status: string };
		expect(reset.runId).not.toBe(first.runId);
		expect(reset.status).toBe("completed");
		expect(persistence.create).toHaveBeenCalledTimes(2);
		expect(persistence.update).toHaveBeenCalled();
		expect(persistence.saveCommand).toHaveBeenCalledTimes(3);
	});

	it("returns a matching durable command without reapplying it", async () => {
		const persistence = {
			create: vi.fn(),
			findCommand: vi.fn().mockResolvedValue({
				payloadHash: "",
				response: "{}",
			}),
		};
		const service = new BrainSandboxService(persistence as never);
		const run = await service.create("alice", 1);
		const input = {
			commandId: "durable",
			expectedRevision: 0,
			action: "run" as const,
		};
		persistence.findCommand.mockResolvedValue({
			payloadHash: createHash("sha256")
				.update(JSON.stringify(input))
				.digest("hex"),
			response: JSON.stringify({ runId: "durable", revision: 9 }),
		});
		await expect(service.control(run.runId, "alice", input)).resolves.toEqual({
			runId: "durable",
			revision: 9,
		});
	});

	it("exposes durable snapshots and rejects missing inspectable data", async () => {
		const persistence = {
			find: vi
				.fn()
				.mockResolvedValueOnce(undefined)
				.mockResolvedValueOnce({ finalSnapshot: null })
				.mockResolvedValueOnce({
					runId: "archived",
					revision: 4,
					status: "completed",
					finalSnapshot: JSON.stringify({ simTimeMs: 9 }),
				}),
		};
		const service = new BrainSandboxService(persistence as never);
		await expect(service.snapshot("none", "alice")).rejects.toThrow(
			/not found/i,
		);
		await expect(service.snapshot("empty", "alice")).rejects.toThrow(
			/unavailable/i,
		);
		await expect(service.snapshot("archived", "alice")).resolves.toMatchObject({
			runId: "archived",
			revision: 4,
			simTimeMs: 9,
		});
	});
});
