import { describe, expect, it, vi } from "vitest";
import { BrainPersistence } from "./persistence";

function persistenceFixture() {
	const operations: unknown[] = [];
	const chain = () => {
		const value = {
			values: vi.fn((input) => {
				operations.push(input);
				return value;
			}),
			set: vi.fn((input) => {
				operations.push(input);
				return value;
			}),
			onConflictDoUpdate: vi.fn(() => value),
			where: vi.fn(() => value),
			orderBy: vi.fn(() => Promise.resolve([])),
		};
		return value;
	};
	const db = {
		insert: vi.fn(() => chain()),
		update: vi.fn(() => chain()),
	};
	const execute = vi.fn(async (work: (value: typeof db) => unknown) =>
		work(db),
	);
	const findFirst = vi.fn().mockResolvedValue({ runId: "r" });
	const client = {
		write: { execute },
		read: {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({ orderBy: vi.fn(() => []) })),
				})),
			})),
			query: { brainExperiments: { findFirst }, brainCommands: { findFirst } },
		},
	};
	return {
		persistence: new BrainPersistence(client as never),
		operations,
		execute,
		findFirst,
	};
}

describe("BrainPersistence", () => {
	it("serializes lifecycle records, checkpoints, commands, and interruption updates", async () => {
		const { persistence, operations, execute } = persistenceFixture();
		await persistence.create({
			runId: "r",
			ownerUserId: "u",
			status: "paused",
			seed: 1,
			engineVersion: 1,
			configVersion: 1,
			resolvedConfig: { a: 1 },
			initialTopology: { b: 2 },
			revision: 0,
		});
		await persistence.saveCheckpoint(
			"r",
			10,
			{ snapshot: true },
			{ spikes: 2 },
		);
		await persistence.update(
			"r",
			"completed",
			1,
			{ counters: { spikes: 2 } },
			"done",
		);
		await persistence.saveCommand({
			ownerUserId: "u",
			commandId: "c",
			runId: "r",
			payloadHash: "h",
			response: { ok: true },
		});
		await persistence.markInterrupted();
		expect(execute).toHaveBeenCalledTimes(5);
		expect(operations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ resolvedConfig: JSON.stringify({ a: 1 }) }),
				expect.objectContaining({
					snapshot: JSON.stringify({ snapshot: true }),
				}),
				expect.objectContaining({ response: JSON.stringify({ ok: true }) }),
			]),
		);
	});

	it("reads owner-scoped experiments and commands", async () => {
		const { persistence, findFirst } = persistenceFixture();
		await expect(persistence.list("u")).resolves.toEqual([]);
		await expect(persistence.find("r", "u")).resolves.toEqual({ runId: "r" });
		await expect(persistence.findCommand("u", "c")).resolves.toEqual({
			runId: "r",
		});
		expect(findFirst).toHaveBeenCalledTimes(2);
	});
});
