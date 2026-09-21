import { createHash, randomUUID } from "node:crypto";
import {
	createExperiment,
	type Experiment,
} from "../../brain/experiment/experiment";
import { terminalStatuses, type RunStatus } from "../../brain/core/types";
import type { ConfigOverrides } from "../../brain/core/config";
import type { ControlInput } from "../../../shared/schemas/experiment.schema";
import { HttpError } from "../../app/http-error";
import type { BrainPersistence } from "./persistence";
import { BrainStreamHub } from "./stream";
import type { Scenario } from "../../brain/experiment/scenario";
type Run = {
	id: string;
	ownerId: string;
	experiment: Experiment;
	status: RunStatus;
	revision: number;
	speed: number;
	commands: Map<string, { payload: string; response: unknown }>;
};
export class BrainSandboxService {
	private readonly runs = new Map<string, Run>();
	readonly stream = new BrainStreamHub();
	constructor(private readonly persistence?: BrainPersistence) {}
	async create(
		ownerId: string,
		seed: number,
		configOverrides: ConfigOverrides = {},
		scenario: Scenario = "food",
	) {
		if (
			[...this.runs.values()].filter(
				(r) => r.ownerId === ownerId && !terminalStatuses.has(r.status),
			).length >= 1
		)
			throw new HttpError(429, "An active experiment already exists");
		if (
			[...this.runs.values()].filter((run) => !terminalStatuses.has(run.status))
				.length >= 4
		)
			throw new HttpError(429, "Server experiment capacity reached");
		const run: Run = {
			id: randomUUID(),
			ownerId,
			experiment: createExperiment(configOverrides, seed, scenario),
			status: "paused",
			revision: 0,
			speed: 1,
			commands: new Map(),
		};
		this.runs.set(run.id, run);
		await this.persistence?.create({
			runId: run.id,
			ownerUserId: ownerId,
			status: run.status,
			seed,
			engineVersion: run.experiment.config.engineVersion,
			configVersion: run.experiment.config.configVersion,
			resolvedConfig: run.experiment.config,
			initialTopology: run.experiment.runtime.network.cloneSnapshot(),
			revision: run.revision,
		});
		return this.summary(run);
	}
	async list(ownerId: string) {
		const active = [...this.runs.values()]
			.filter((r) => r.ownerId === ownerId)
			.map((r) => this.summary(r));
		const activeIds = new Set(active.map((run) => run.runId));
		const persisted = ((await this.persistence?.list(ownerId)) ?? [])
			.filter((row) => !activeIds.has(row.runId))
			.map((row) => ({
				runId: row.runId,
				status: row.status,
				revision: row.revision,
				simTimeMs: 0,
				seed: row.seed,
				resolvedConfig: JSON.parse(row.resolvedConfig) as unknown,
			}));
		return [...active, ...persisted];
	}
	private get(id: string, ownerId: string) {
		const run = this.runs.get(id);
		if (!run || run.ownerId !== ownerId)
			throw new HttpError(404, "Experiment not found");
		return run;
	}
	async snapshot(id: string, ownerId: string) {
		const run = this.runs.get(id);
		if (!run) {
			const persisted = await this.persistence?.find(id, ownerId);
			if (!persisted) throw new HttpError(404, "Experiment not found");
			if (!persisted.finalSnapshot)
				throw new HttpError(409, "Experiment snapshot is unavailable");
			return {
				schemaVersion: 1,
				runId: persisted.runId,
				revision: persisted.revision,
				status: persisted.status,
				...(JSON.parse(persisted.finalSnapshot) as object),
			};
		}
		if (run.ownerId !== ownerId)
			throw new HttpError(404, "Experiment not found");
		return {
			schemaVersion: 1,
			runId: run.id,
			revision: run.revision,
			...run.experiment.snapshot(),
			status: run.status,
		};
	}
	neuron(id: string, neuronId: number, ownerId: string) {
		const run = this.get(id, ownerId);
		const neuron = run.experiment.runtime.network.neurons.get(neuronId);
		if (!neuron) throw new HttpError(404, "Neuron not found");
		const edges = (ids: Iterable<number>) =>
			[...ids]
				.map((edgeId) => run.experiment.runtime.network.synapses.get(edgeId))
				.filter((edge): edge is NonNullable<typeof edge> => Boolean(edge));
		return {
			neuron: { ...neuron, position: { ...neuron.position } },
			incoming: edges(
				run.experiment.runtime.network.incoming.get(neuronId) ?? [],
			),
			outgoing: edges(
				run.experiment.runtime.network.outgoing.get(neuronId) ?? [],
			),
		};
	}
	synapse(id: string, synapseId: number, ownerId: string) {
		const run = this.get(id, ownerId);
		const synapse = run.experiment.runtime.network.synapses.get(synapseId);
		if (!synapse) throw new HttpError(404, "Synapse not found");
		return {
			synapse: { ...synapse },
			ageMs: run.experiment.runtime.simTimeMs - synapse.createdAt,
		};
	}
	export(id: string, ownerId: string) {
		const run = this.get(id, ownerId);
		return {
			schemaVersion: 1,
			runId: run.id,
			seed: run.experiment.seed,
			config: run.experiment.config,
			initialTopology: run.experiment.runtime.network.cloneSnapshot(),
			finalSnapshot: run.experiment.snapshot(),
		};
	}
	async control(id: string, ownerId: string, input: ControlInput) {
		const run = this.get(id, ownerId);
		const payload = JSON.stringify(input);
		const payloadHash = createHash("sha256").update(payload).digest("hex");
		const prior = run.commands.get(input.commandId);
		if (prior) {
			if (prior.payload !== payload)
				throw new HttpError(409, "commandId payload mismatch");
			return prior.response;
		}
		const persistedCommand = await this.persistence?.findCommand(
			ownerId,
			input.commandId,
		);
		if (persistedCommand) {
			if (persistedCommand.payloadHash !== payloadHash)
				throw new HttpError(409, "commandId payload mismatch");
			return JSON.parse(persistedCommand.response) as unknown;
		}
		if (input.expectedRevision !== run.revision)
			throw new HttpError(409, "Experiment revision conflict");
		if (terminalStatuses.has(run.status))
			throw new HttpError(409, "Experiment has ended");
		if (input.action === "step") {
			run.experiment.advanceTo(run.experiment.runtime.simTimeMs + 100);
			run.status = "paused";
		} else if (input.action === "run") {
			run.status = "running";
		} else if (input.action === "pause") {
			run.status = "paused";
		} else {
			const previousStatus = run.status;
			run.status = "completed";
			run.revision++;
			let next: Awaited<ReturnType<BrainSandboxService["create"]>>;
			try {
				next = await this.create(ownerId, run.experiment.seed);
			} catch (error) {
				run.status = previousStatus;
				run.revision--;
				throw error;
			}
			const response = { ...this.summary(run), runId: next.runId };
			run.commands.set(input.commandId, { payload, response });
			await this.persistence?.update(
				run.id,
				run.status,
				run.revision,
				run.experiment.snapshot(),
				"manual_reset",
			);
			await this.persistence?.saveCommand({
				ownerUserId: ownerId,
				commandId: input.commandId,
				runId: run.id,
				payloadHash,
				response,
			});
			this.stream.publish(run.id, await this.snapshot(run.id, ownerId));
			return response;
		}
		if (input.speed) run.speed = input.speed;
		run.revision++;
		const response = this.summary(run);
		run.commands.set(input.commandId, { payload, response });
		await this.persistence?.update(
			run.id,
			run.status,
			run.revision,
			run.experiment.snapshot(),
		);
		await this.persistence?.saveCommand({
			ownerUserId: ownerId,
			commandId: input.commandId,
			runId: run.id,
			payloadHash,
			response,
		});
		this.stream.publish(run.id, await this.snapshot(run.id, ownerId));
		return response;
	}
	async tick() {
		for (const run of this.runs.values())
			if (run.status === "running") {
				const target =
					run.experiment.runtime.simTimeMs + Math.round(100 * run.speed);
				run.experiment.advanceTo(target);
				if (!run.experiment.body.alive) run.status = "dead";
				else if (run.experiment.runtime.status === "completed")
					run.status = "completed";
				if (run.experiment.runtime.simTimeMs % 30_000 === 0)
					await this.persistence?.saveCheckpoint(
						run.id,
						run.experiment.runtime.simTimeMs,
						run.experiment.snapshot(),
						run.experiment.runtime.readSnapshot().counters,
					);
				if (terminalStatuses.has(run.status))
					await this.persistence?.update(
						run.id,
						run.status,
						run.revision,
						run.experiment.snapshot(),
						run.status === "dead" ? "energy_depleted" : undefined,
					);
				this.stream.publish(run.id, await this.snapshot(run.id, run.ownerId));
			}
	}
	private summary(run: Run) {
		return {
			runId: run.id,
			status: run.status,
			revision: run.revision,
			simTimeMs: run.experiment.runtime.simTimeMs,
			seed: run.experiment.seed,
			resolvedConfig: run.experiment.config,
		};
	}
	async shutdown(): Promise<void> {
		this.stream.close();
	}
}
