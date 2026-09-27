import {
	OBSERVATORY_SCHEMA_VERSION,
	type ObservatoryEvent,
	type Scenario,
	type Snapshot,
	snapshotSchema,
	type Telemetry,
} from "../../../../shared/schemas/observatory";

const TICK_MS = 1_000;
const EXPECTED_INTERVAL_MS = 1_000;
const SAAA_TARGETS = [
	{
		id: "agent-core",
		kind: "agent",
		label: "SAAA Agent Core",
		description: "Coordinates tasks and connected services",
		symbol: "orchestrator",
	},
	{
		id: "runtime",
		kind: "runtime",
		label: "LARM Harness",
		description: "Resolves and reaches the LARM service catalog",
		symbol: "server",
		diagnosisId: "harness.reachability",
	},
	{
		id: "llm",
		kind: "service",
		label: "LLM Response",
		description: "Generates the primary response",
		symbol: "network",
		diagnosisId: "harness.llm",
	},
	{
		id: "backchannel",
		kind: "service",
		label: "Backchannel",
		description: "Generates a separate backchannel response",
		symbol: "backchannel",
		diagnosisId: "harness.backchannel",
	},
	{
		id: "asr",
		kind: "service",
		label: "Speech Recognition",
		description: "Converts speech input to text",
		symbol: "microphone",
		diagnosisId: "harness.asr",
	},
	{
		id: "tts",
		kind: "service",
		label: "Speech Synthesis",
		description: "Converts responses to speech",
		symbol: "speaker",
		diagnosisId: "harness.tts",
	},
	{
		id: "embedding",
		kind: "service",
		label: "Embedding",
		description: "Builds vector representations for retrieval",
		symbol: "embedding",
		diagnosisId: "harness.embedding",
	},
	{
		id: "sqlite",
		kind: "service",
		label: "SQLite Database",
		description: "Stores local application state",
		symbol: "database",
		diagnosisId: "sqlite",
	},
	{
		id: "memory",
		kind: "memory",
		label: "Personal State Memory",
		description: "Reads and maintains personal state",
		symbol: "brain",
		diagnosisId: "memory.personal_state",
	},
	{
		id: "world-model",
		kind: "model",
		label: "World Model",
		description: "Provides the world model status and capabilities",
		symbol: "world",
		diagnosisId: "world.status",
	},
	{
		id: "tool",
		kind: "tool",
		label: "ToolChain",
		description: "Maintains the tool selection catalog",
		symbol: "gear",
		diagnosisId: "tool_selection.catalog",
	},
	{
		id: "context-recall",
		kind: "service",
		label: "ContextStill Recall",
		description: "Recalls stored context",
		symbol: "recall",
		diagnosisId: "context_still.recall",
	},
	{
		id: "context-search",
		kind: "service",
		label: "ContextStill Search",
		description: "Searches stored context",
		symbol: "search",
		diagnosisId: "context_still.search",
	},
] as const satisfies ReadonlyArray<
	Pick<
		Snapshot["entities"][number],
		"id" | "kind" | "label" | "description" | "symbol" | "diagnosisId"
	>
>;
export const MOCK_SCENARIOS: readonly { id: Scenario; label: string }[] = [
	{ id: "normal", label: "Normal" },
	{ id: "high-activity", label: "High activity" },
	{ id: "task-heavy", label: "Task heavy" },
	{ id: "runtime-degraded", label: "Runtime degraded" },
	{ id: "total-signal-loss", label: "Total signal loss" },
	{ id: "recovery", label: "Recovery" },
];

export type StreamPacket =
	| { id: string; event: "snapshot"; data: Snapshot }
	| { id: string; event: "telemetry"; data: Telemetry }
	| { id: string; event: "event"; data: ObservatoryEvent };

export type SimulatorOptions = {
	seed?: number;
	initialTime?: number;
	clock?: { now: () => number };
	instanceId?: string;
	intervalMs?: number;
};

function activity(seed: number, tick: number, multiplier: number) {
	const variation = ((seed * 1103515245 + tick * 12345) >>> 0) % 20;
	return Math.min(1, ((20 + variation) * multiplier) / 100);
}

export class MockSignalSimulator {
	private readonly seed: number;
	private readonly initialTime: number;
	private readonly instanceId: string;
	private readonly intervalMs: number;
	private tick = 0;
	private revision = 0;
	private sequence = 0;
	private scenario: Scenario = "normal";
	private scenarioStartedTick = 0;
	private signalLostAt: number | null = null;
	private frozenTasks: Snapshot["tasks"] | null = null;
	private readonly subscribers = new Set<(packet: StreamPacket) => void>();
	private timer: ReturnType<typeof setInterval> | null = null;

	constructor(options: SimulatorOptions = {}) {
		this.seed = options.seed ?? 42;
		this.initialTime =
			options.initialTime ?? options.clock?.now() ?? Date.now();
		this.instanceId = options.instanceId ?? crypto.randomUUID();
		this.intervalMs = options.intervalMs ?? TICK_MS;
		if (
			!Number.isInteger(this.seed) ||
			this.seed < 0 ||
			this.seed > 2_147_483_647
		)
			throw new RangeError("Invalid seed");
		if (!Number.isInteger(this.initialTime) || this.initialTime < 0)
			throw new RangeError("Invalid initial time");
		if (!Number.isInteger(this.intervalMs) || this.intervalMs <= 0)
			throw new RangeError("Invalid interval");
	}

	private now() {
		return this.initialTime + this.tick * TICK_MS;
	}
	private packetId() {
		return `${this.instanceId}:${this.sequence}`;
	}
	private nextPacketId() {
		this.sequence += 1;
		return this.packetId();
	}
	get subscriberCount() {
		return this.subscribers.size;
	}
	get currentScenario() {
		return this.scenario;
	}

	snapshot(): Snapshot {
		const now = this.now();
		const lost = this.scenario === "total-signal-loss";
		const activeStepIndex = Math.floor(this.tick / 3) % 3;
		const activePipelineTaskId = `context-task-${Math.floor(this.tick / 9) + 1}`;
		const lastSeenAt = lost ? (this.signalLostAt ?? now) : now;
		const age = now - lastSeenAt;
		const freshness = lost
			? age >= 5_000
				? "disconnected"
				: age >= 2_000
					? "stale"
					: "healthy"
			: "healthy";
		const degraded = this.scenario === "runtime-degraded";
		const currentActivity = lost
			? 0
			: activity(
					this.seed,
					this.tick,
					this.scenario === "high-activity" ? 2.5 : 1,
				);
		const taskCount = this.scenario === "task-heavy" ? 3 : 1;
		const taskStates = [
			"accepted",
			"planning",
			"working",
			"verifying",
			"completed",
		] as const;
		const tasks: Snapshot["tasks"] =
			lost && this.frozenTasks
				? this.frozenTasks
				: Array.from({ length: taskCount }, (_, index) => {
						const step = Math.max(
							0,
							this.tick - this.scenarioStartedTick - index,
						);
						const state = taskStates[Math.min(step, 4)] ?? "completed";
						return {
							id: `task-${index + 1}`,
							label: `Repository analysis ${index + 1}`,
							state,
							currentAction:
								state === "completed"
									? "Complete"
									: `${state} repository analysis`,
							completedSteps: taskStates
								.slice(0, Math.min(step, 4))
								.map(String),
							updatedAt: lastSeenAt,
						};
					});
		const snapshot: Snapshot = {
			schemaVersion: OBSERVATORY_SCHEMA_VERSION,
			instanceId: this.instanceId,
			revision: this.revision,
			scenario: this.scenario,
			seed: this.seed,
			tick: this.tick,
			generatedAt: now,
			entities: SAAA_TARGETS.map((target) => ({
				...target,
				health: target.id === "runtime" && degraded ? "degraded" : freshness,
				activity:
					target.id === "agent-core" || target.id === "runtime"
						? currentActivity
						: currentActivity / 2,
				expectedIntervalMs: EXPECTED_INTERVAL_MS,
				lastSeenAt,
			})),
			boundaries: [
				{
					id: "core-runtime",
					source: "agent-core",
					target: "runtime",
					health: degraded ? "degraded" : freshness,
					activity: currentActivity,
					latencyMs: degraded ? 450 : 35,
					expectedIntervalMs: EXPECTED_INTERVAL_MS,
					lastSeenAt,
				},
				{
					id: "core-memory",
					source: "agent-core",
					target: "memory",
					health: freshness,
					activity: currentActivity / 2,
					latencyMs: 20,
					expectedIntervalMs: EXPECTED_INTERVAL_MS,
					lastSeenAt,
				},
				{
					id: "core-tool",
					source: "agent-core",
					target: "tool",
					health: freshness,
					activity: currentActivity / 2,
					latencyMs: 30,
					expectedIntervalMs: EXPECTED_INTERVAL_MS,
					lastSeenAt,
				},
			],
			tasks,
			pipelines: [
				{
					id: "context-still",
					label: "ContextStill",
					stages: [
						{
							id: "finding",
							label: "Finding",
							kind: "step" as const,
							activeTaskId:
								!lost && activeStepIndex === 0 ? activePipelineTaskId : null,
							queueDepth: 0,
							status: lost ? ("stalled" as const) : ("running" as const),
						},
						{
							id: "covering",
							label: "Covering",
							kind: "step" as const,
							activeTaskId:
								!lost && activeStepIndex === 1 ? activePipelineTaskId : null,
							queueDepth: 0,
							status: lost ? ("stalled" as const) : ("running" as const),
						},
						{
							id: "finalize",
							label: "Finalize",
							kind: "step" as const,
							activeTaskId:
								!lost && activeStepIndex === 2 ? activePipelineTaskId : null,
							queueDepth: 0,
							status: lost ? ("stalled" as const) : ("running" as const),
						},
						{
							id: "review-queue",
							label: "Review queue",
							kind: "queue" as const,
							activeTaskId:
								!lost && this.tick % 4 < 2
									? `review-task-${Math.floor(this.tick / 4) + 1}`
									: null,
							queueDepth: lost
								? 0
								: this.tick % (this.scenario === "high-activity" ? 5 : 3),
							status: lost ? ("stalled" as const) : ("running" as const),
						},
						{
							id: "knowledge-queue",
							label: "Knowledge queue",
							kind: "queue" as const,
							activeTaskId:
								!lost && this.tick % 5 < 2
									? `knowledge-task-${Math.floor(this.tick / 5) + 1}`
									: null,
							queueDepth: lost ? 0 : Math.floor(this.tick / 2) % 3,
							status: lost ? ("stalled" as const) : ("running" as const),
						},
					],
					links: [
						{ source: "finding", target: "covering" },
						{ source: "covering", target: "finalize" },
					],
				},
			],
		};
		return snapshotSchema.parse(snapshot);
	}

	subscribe(listener: (packet: StreamPacket) => void): () => void {
		this.subscribers.add(listener);
		try {
			listener({
				id: this.packetId(),
				event: "snapshot",
				data: this.snapshot(),
			});
		} catch (error) {
			this.subscribers.delete(listener);
			throw error;
		}
		return () => {
			this.subscribers.delete(listener);
		};
	}

	private emit(packet: StreamPacket) {
		for (const listener of this.subscribers) {
			try {
				listener(packet);
			} catch {
				this.subscribers.delete(listener);
			}
		}
	}

	private emitEvent(
		kind: ObservatoryEvent["kind"],
		source: string,
		target?: string,
		taskId?: string,
	) {
		const sequence = this.sequence + 1;
		const event: ObservatoryEvent = {
			schemaVersion: OBSERVATORY_SCHEMA_VERSION,
			id: `${this.instanceId}:${sequence}`,
			instanceId: this.instanceId,
			sequence,
			timestamp: this.now(),
			kind,
			source,
			target,
			taskId,
			correlationId: "demo-flow",
			severity:
				kind === "signal.lost"
					? "error"
					: kind === "boundary.degraded"
						? "warn"
						: "info",
		};
		this.emit({ id: this.nextPacketId(), event: "event", data: event });
	}

	advance(ticks = 1) {
		if (!Number.isInteger(ticks) || ticks < 1 || ticks > 1_000)
			throw new RangeError("Invalid tick count");
		for (let index = 0; index < ticks; index += 1) {
			this.tick += 1;
			this.revision += 1;
			if (this.scenario !== "total-signal-loss") {
				const snapshot = this.snapshot();
				const telemetry: Telemetry = {
					schemaVersion: OBSERVATORY_SCHEMA_VERSION,
					targetId: "agent-core",
					observedAt: this.now(),
					metric: "activity",
					value: snapshot.entities[0]?.activity ?? 0,
				};
				this.emit({
					id: this.nextPacketId(),
					event: "telemetry",
					data: telemetry,
				});
				this.emitEvent("signal.sent", "agent-core", "runtime");
				const taskCount = this.scenario === "task-heavy" ? 3 : 1;
				const scenarioTick = this.tick - this.scenarioStartedTick;
				for (let taskIndex = 0; taskIndex < taskCount; taskIndex += 1) {
					if (scenarioTick === taskIndex + 1)
						this.emitEvent(
							"task.started",
							"agent-core",
							undefined,
							`task-${taskIndex + 1}`,
						);
					if (scenarioTick === taskIndex + 4)
						this.emitEvent(
							"task.completed",
							"agent-core",
							undefined,
							`task-${taskIndex + 1}`,
						);
				}
				if (this.tick % 9 === 3 || this.tick % 9 === 6)
					this.emitEvent(
						"pipeline.item.moved",
						this.tick % 9 === 6 ? "covering" : "finding",
						this.tick % 9 === 6 ? "finalize" : "covering",
						`context-task-${Math.floor(this.tick / 9) + 1}`,
					);
			}
			this.emit({
				id: this.nextPacketId(),
				event: "snapshot",
				data: this.snapshot(),
			});
		}
		return this.snapshot();
	}

	setScenario(scenario: Scenario) {
		if (scenario === this.scenario) return this.snapshot();
		const previous = this.scenario;
		this.frozenTasks =
			scenario === "total-signal-loss" ? this.snapshot().tasks : null;
		this.scenario = scenario;
		this.scenarioStartedTick = this.tick;
		this.signalLostAt = scenario === "total-signal-loss" ? this.now() : null;
		this.revision += 1;
		if (scenario === "total-signal-loss")
			this.emitEvent("signal.lost", "agent-core");
		else if (previous === "total-signal-loss")
			this.emitEvent("signal.recovered", "agent-core");
		else if (scenario === "runtime-degraded")
			this.emitEvent("boundary.degraded", "agent-core", "runtime");
		const snapshot = this.snapshot();
		this.emit({ id: this.nextPacketId(), event: "snapshot", data: snapshot });
		return snapshot;
	}

	start() {
		if (this.timer) return;
		this.timer = setInterval(() => this.advance(), this.intervalMs);
		this.timer.unref?.();
	}

	stop() {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
		this.subscribers.clear();
	}
}
