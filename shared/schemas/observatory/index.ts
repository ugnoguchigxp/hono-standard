import { z } from "zod";

export const OBSERVATORY_SCHEMA_VERSION = 1 as const;
const id = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const timestamp = z.number().int().nonnegative();
const ratio = z.number().finite().min(0).max(1);

export const healthSchema = z.enum([
	"healthy",
	"degraded",
	"stale",
	"disconnected",
	"fault",
	"unknown",
]);
export const scenarioSchema = z.enum([
	"normal",
	"high-activity",
	"task-heavy",
	"runtime-degraded",
	"total-signal-loss",
	"recovery",
]);
export const taskStateSchema = z.enum([
	"accepted",
	"scheduled",
	"planning",
	"working",
	"waiting",
	"blocked",
	"verifying",
	"completed",
	"failed",
]);
export const entitySymbolSchema = z.enum([
	"orchestrator",
	"brain",
	"network",
	"world",
	"server",
	"gear",
	"gateway",
	"database",
	"microphone",
	"speaker",
	"embedding",
	"backchannel",
	"search",
	"recall",
	"service",
	"task",
	"pipeline",
]);
export const entitySchema = z
	.object({
		id,
		kind: z.enum([
			"system",
			"agent",
			"service",
			"runtime",
			"model",
			"memory",
			"task",
			"tool",
			"pipeline",
			"external",
		]),
		label: z.string().min(1).max(100),
		description: z.string().min(1).max(160).optional(),
		diagnosisId: z
			.string()
			.regex(/^[a-z][a-z0-9_.-]{0,99}$/)
			.optional(),
		symbol: entitySymbolSchema.optional(),
		health: healthSchema,
		activity: ratio,
		expectedIntervalMs: z.number().int().positive().max(60_000),
		lastSeenAt: timestamp,
	})
	.strict();
export const boundarySchema = z
	.object({
		id,
		source: id,
		target: id,
		health: healthSchema,
		activity: ratio,
		latencyMs: z.number().finite().nonnegative().max(60_000),
		expectedIntervalMs: z.number().int().positive().max(60_000),
		lastSeenAt: timestamp,
	})
	.strict();
export const taskSchema = z
	.object({
		id,
		label: z.string().min(1).max(100),
		state: taskStateSchema,
		currentAction: z.string().max(160),
		completedSteps: z.array(z.string().max(100)).max(20),
		updatedAt: timestamp,
	})
	.strict();
export const pipelineSchema = z
	.object({
		id,
		label: z.string().min(1).max(100),
		stages: z
			.array(
				z
					.object({
						id,
						label: z.string().min(1).max(100),
						kind: z.enum(["step", "queue"]),
						activeTaskId: id.nullable(),
						queueDepth: z.number().int().nonnegative().max(10_000),
						status: z.enum(["running", "stalled"]),
					})
					.strict(),
			)
			.min(1)
			.max(20),
		links: z.array(z.object({ source: id, target: id }).strict()).max(40),
	})
	.strict();

export const snapshotSchema = z
	.object({
		schemaVersion: z.literal(OBSERVATORY_SCHEMA_VERSION),
		instanceId: z.string().uuid(),
		revision: z.number().int().nonnegative(),
		scenario: scenarioSchema,
		seed: z.number().int().nonnegative().max(2_147_483_647),
		tick: z.number().int().nonnegative(),
		generatedAt: timestamp,
		entities: z.array(entitySchema).max(100),
		boundaries: z.array(boundarySchema).max(200),
		tasks: z.array(taskSchema).max(100),
		pipelines: z.array(pipelineSchema).max(20),
	})
	.strict()
	.superRefine((snapshot, context) => {
		const entityIds = new Set(snapshot.entities.map((entity) => entity.id));
		if (entityIds.size !== snapshot.entities.length)
			context.addIssue({
				code: "custom",
				path: ["entities"],
				message: "Duplicate entity ID",
			});
		const boundaryIds = new Set(
			snapshot.boundaries.map((boundary) => boundary.id),
		);
		if (boundaryIds.size !== snapshot.boundaries.length)
			context.addIssue({
				code: "custom",
				path: ["boundaries"],
				message: "Duplicate boundary ID",
			});
		for (const [index, boundary] of snapshot.boundaries.entries()) {
			if (!entityIds.has(boundary.source) || !entityIds.has(boundary.target))
				context.addIssue({
					code: "custom",
					path: ["boundaries", index],
					message: "Unknown boundary endpoint",
				});
		}
		const taskIds = new Set(snapshot.tasks.map((task) => task.id));
		if (taskIds.size !== snapshot.tasks.length)
			context.addIssue({
				code: "custom",
				path: ["tasks"],
				message: "Duplicate task ID",
			});
		const pipelineIds = new Set(
			snapshot.pipelines.map((pipeline) => pipeline.id),
		);
		if (pipelineIds.size !== snapshot.pipelines.length)
			context.addIssue({
				code: "custom",
				path: ["pipelines"],
				message: "Duplicate pipeline ID",
			});
		for (const [index, pipeline] of snapshot.pipelines.entries()) {
			const stageIds = new Set(pipeline.stages.map((stage) => stage.id));
			if (stageIds.size !== pipeline.stages.length)
				context.addIssue({
					code: "custom",
					path: ["pipelines", index, "stages"],
					message: "Duplicate stage ID",
				});
			const links = new Set<string>();
			for (const [linkIndex, link] of pipeline.links.entries()) {
				const key = `${link.source}:${link.target}`;
				if (
					!stageIds.has(link.source) ||
					!stageIds.has(link.target) ||
					link.source === link.target ||
					links.has(key)
				)
					context.addIssue({
						code: "custom",
						path: ["pipelines", index, "links", linkIndex],
						message: "Invalid pipeline link",
					});
				links.add(key);
			}
		}
	});

const telemetryBase = {
	schemaVersion: z.literal(OBSERVATORY_SCHEMA_VERSION),
	targetId: id,
	observedAt: timestamp,
};
export const telemetrySchema = z.discriminatedUnion("metric", [
	z
		.object({ ...telemetryBase, metric: z.literal("activity"), value: ratio })
		.strict(),
	z
		.object({
			...telemetryBase,
			metric: z.literal("latency-ms"),
			value: z.number().finite().nonnegative().max(60_000),
		})
		.strict(),
	z
		.object({
			...telemetryBase,
			metric: z.literal("queue-depth"),
			pipelineId: id,
			value: z.number().int().nonnegative().max(10_000),
		})
		.strict(),
]);
export const eventSchema = z
	.object({
		schemaVersion: z.literal(OBSERVATORY_SCHEMA_VERSION),
		id: z.string().max(100),
		instanceId: z.string().uuid(),
		sequence: z.number().int().positive(),
		timestamp,
		kind: z.enum([
			"task.started",
			"task.completed",
			"signal.sent",
			"boundary.degraded",
			"signal.lost",
			"signal.recovered",
			"pipeline.item.moved",
		]),
		source: id,
		target: id.optional(),
		correlationId: id.optional(),
		taskId: id.optional(),
		traceId: id.optional(),
		severity: z.enum(["info", "warn", "error"]),
	})
	.strict();

export type Scenario = z.infer<typeof scenarioSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Telemetry = z.infer<typeof telemetrySchema>;
export type ObservatoryEvent = z.infer<typeof eventSchema>;
export type Health = z.infer<typeof healthSchema>;
