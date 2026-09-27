import {
	eventSchema,
	snapshotSchema,
	telemetrySchema,
	type ObservatoryEvent,
	type Snapshot,
} from "@shared/schemas/observatory";
import type { SseRecord } from "./stream-parser";

export type SpatialData = {
	snapshot: Snapshot;
	events: ObservatoryEvent[];
	lastSequence: number;
};

function parsePacketId(id: string | undefined): {
	instanceId: string;
	sequence: number;
} {
	const match = /^([0-9a-f-]{36}):(\d+)$/.exec(id ?? "");
	if (!match) throw new Error("Invalid observatory stream ID");
	return { instanceId: match[1] ?? "", sequence: Number(match[2]) };
}

export function applySseRecord(
	current: SpatialData | null,
	record: SseRecord,
	initial = false,
): SpatialData | null {
	if (record.event === "heartbeat") {
		if (!current || initial) return current;
		const heartbeat = JSON.parse(record.data);
		if (heartbeat?.instanceId !== current.snapshot.instanceId)
			throw new Error("Observatory instance changed");
		return current;
	}
	const { instanceId, sequence } = parsePacketId(record.id);
	if (!Number.isSafeInteger(sequence) || sequence < 0)
		throw new Error("Invalid observatory sequence");
	if (initial) {
		if (record.event !== "snapshot")
			throw new Error("Expected observatory snapshot");
		const snapshot = snapshotSchema.parse(JSON.parse(record.data));
		if (snapshot.instanceId !== instanceId)
			throw new Error("Snapshot instance mismatch");
		return { snapshot, events: [], lastSequence: sequence };
	}
	if (!current) throw new Error("Missing observatory snapshot");
	if (instanceId !== current.snapshot.instanceId)
		throw new Error("Observatory instance changed");
	if (sequence <= current.lastSequence) return current;
	if (sequence !== current.lastSequence + 1)
		throw new Error("Observatory sequence gap");
	if (record.event === "snapshot") {
		const snapshot = snapshotSchema.parse(JSON.parse(record.data));
		if (
			snapshot.instanceId !== instanceId ||
			snapshot.revision < current.snapshot.revision
		)
			throw new Error("Invalid observatory revision");
		return { ...current, snapshot, lastSequence: sequence };
	}
	if (record.event === "event") {
		const event = eventSchema.parse(JSON.parse(record.data));
		if (
			event.id !== record.id ||
			event.instanceId !== instanceId ||
			event.sequence !== sequence
		)
			throw new Error("Event ID mismatch");
		return {
			...current,
			events: [event, ...current.events].slice(0, 30),
			lastSequence: sequence,
		};
	}
	if (record.event === "telemetry") {
		const telemetry = telemetrySchema.parse(JSON.parse(record.data));
		const snapshot = { ...current.snapshot };
		if (telemetry.metric === "activity") {
			if (!snapshot.entities.some((entity) => entity.id === telemetry.targetId))
				throw new Error("Unknown observatory telemetry target");
			snapshot.entities = snapshot.entities.map((entity) =>
				entity.id === telemetry.targetId
					? { ...entity, activity: telemetry.value }
					: entity,
			);
		}
		if (telemetry.metric === "latency-ms") {
			if (
				!snapshot.boundaries.some(
					(boundary) => boundary.id === telemetry.targetId,
				)
			)
				throw new Error("Unknown observatory telemetry target");
			snapshot.boundaries = snapshot.boundaries.map((boundary) =>
				boundary.id === telemetry.targetId
					? { ...boundary, latencyMs: telemetry.value }
					: boundary,
			);
		}
		if (telemetry.metric === "queue-depth") {
			if (
				!snapshot.pipelines.some(
					(pipeline) =>
						pipeline.id === telemetry.pipelineId &&
						pipeline.stages.some((stage) => stage.id === telemetry.targetId),
				)
			)
				throw new Error("Unknown observatory telemetry target");
			snapshot.pipelines = snapshot.pipelines.map((pipeline) => ({
				...pipeline,
				stages:
					pipeline.id === telemetry.pipelineId
						? pipeline.stages.map((stage) =>
								stage.id === telemetry.targetId
									? { ...stage, queueDepth: telemetry.value }
									: stage,
							)
						: pipeline.stages,
			}));
		}
		return { ...current, snapshot, lastSequence: sequence };
	}
	throw new Error("Unknown observatory stream event");
}

export function summarize(
	snapshot: Pick<Snapshot, "entities" | "boundaries" | "tasks" | "pipelines">,
) {
	const counts: Record<string, number> = {};
	for (const entity of snapshot.entities)
		counts[entity.health] = (counts[entity.health] ?? 0) + 1;
	const boundaryCounts: Record<string, number> = {};
	for (const boundary of snapshot.boundaries)
		boundaryCounts[boundary.health] =
			(boundaryCounts[boundary.health] ?? 0) + 1;
	return {
		entityHealth: counts,
		boundaryHealth: boundaryCounts,
		taskCount: snapshot.tasks.length,
		pipelineCount: snapshot.pipelines.length,
	};
}
