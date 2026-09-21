import { and, desc, eq, inArray } from "drizzle-orm";
import type { AppDatabaseClient } from "../../db";
import {
	brainCheckpoints,
	brainCommands,
	brainExperiments,
} from "../../db/schema";

export class BrainPersistence {
	constructor(private readonly database: AppDatabaseClient) {}
	async create(input: {
		runId: string;
		ownerUserId: string;
		status: string;
		seed: number;
		engineVersion: number;
		configVersion: number;
		resolvedConfig: unknown;
		initialTopology: unknown;
		revision: number;
	}) {
		await this.database.write.execute((db) =>
			db.insert(brainExperiments).values({
				...input,
				resolvedConfig: JSON.stringify(input.resolvedConfig),
				initialTopology: JSON.stringify(input.initialTopology),
			}),
		);
	}
	async saveCheckpoint(
		runId: string,
		simTimeMs: number,
		snapshot: unknown,
		metrics: unknown,
	) {
		await this.database.write.execute((db) =>
			db
				.insert(brainCheckpoints)
				.values({
					runId,
					simTimeMs,
					snapshot: JSON.stringify(snapshot),
					metrics: JSON.stringify(metrics),
				})
				.onConflictDoUpdate({
					target: [brainCheckpoints.runId, brainCheckpoints.simTimeMs],
					set: {
						snapshot: JSON.stringify(snapshot),
						metrics: JSON.stringify(metrics),
					},
				}),
		);
	}
	async update(
		runId: string,
		status: string,
		revision: number,
		snapshot: unknown,
		terminalReason?: string,
	) {
		await this.database.write.execute((db) =>
			db
				.update(brainExperiments)
				.set({
					status,
					revision,
					terminalReason,
					finalSnapshot: JSON.stringify(snapshot),
					summaryMetrics: JSON.stringify(
						(snapshot as { counters?: unknown }).counters ?? {},
					),
					updatedAt: new Date(),
				})
				.where(eq(brainExperiments.runId, runId)),
		);
	}
	async saveCommand(input: {
		ownerUserId: string;
		commandId: string;
		runId: string;
		payloadHash: string;
		response: unknown;
	}) {
		await this.database.write.execute((db) =>
			db
				.insert(brainCommands)
				.values({ ...input, response: JSON.stringify(input.response) }),
		);
	}
	async findCommand(ownerUserId: string, commandId: string) {
		return this.database.read.query.brainCommands.findFirst({
			where: and(
				eq(brainCommands.ownerUserId, ownerUserId),
				eq(brainCommands.commandId, commandId),
			),
		});
	}
	async list(ownerUserId: string) {
		return this.database.read
			.select()
			.from(brainExperiments)
			.where(eq(brainExperiments.ownerUserId, ownerUserId))
			.orderBy(desc(brainExperiments.updatedAt));
	}
	async find(runId: string, ownerUserId: string) {
		return this.database.read.query.brainExperiments.findFirst({
			where: and(
				eq(brainExperiments.runId, runId),
				eq(brainExperiments.ownerUserId, ownerUserId),
			),
		});
	}
	async markInterrupted(): Promise<void> {
		await this.database.write.execute((db) =>
			db
				.update(brainExperiments)
				.set({
					status: "interrupted",
					terminalReason: "server_restart",
					updatedAt: new Date(),
				})
				.where(inArray(brainExperiments.status, ["paused", "running"])),
		);
	}
}
