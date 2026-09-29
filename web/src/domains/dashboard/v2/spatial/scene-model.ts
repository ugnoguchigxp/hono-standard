import type { Health, Snapshot } from "@shared/schemas/observatory";

export type Selection = {
	kind: "entity" | "boundary" | "task" | "pipeline" | "stage";
	id: string;
	pipelineId?: string;
} | null;
export type Point = readonly [number, number, number];
export type Orbit = {
	radius: number;
	inclination: number;
	nodeAngle: number;
	phase: number;
	periodMs: number;
	yOffset: number;
};
export type EntitySymbol = NonNullable<Snapshot["entities"][number]["symbol"]>;
export type SceneNode = Snapshot["entities"][number] & {
	symbol: EntitySymbol;
	visualState: VisualState;
	position: Point;
	orbit: Orbit;
};
export type VisualState =
	| "start-active"
	| "idle"
	| "processing-light"
	| "processing"
	| "heavy-load"
	| "warn"
	| "danger"
	| "dead"
	| "unknown";

export const stateVisual: Record<
	VisualState,
	{ color: string; label: string }
> = {
	"start-active": { color: "#2857ad", label: "StartActive" },
	idle: { color: "#4b9cff", label: "Idle" },
	"processing-light": { color: "#b8f6c5", label: "Processing" },
	processing: { color: "#148b49", label: "Processing" },
	"heavy-load": { color: "#f3df57", label: "Heavy load" },
	warn: { color: "#ff9e45", label: "Warn" },
	danger: { color: "#ff858e", label: "Danger" },
	dead: { color: "#f43e5c", label: "Dead" },
	unknown: { color: "#ad86ed", label: "Unknown" },
};

export function entityVisualState(
	entity: Snapshot["entities"][number],
	snapshot: Pick<Snapshot, "scenario" | "tasks">,
): VisualState {
	if (entity.health === "disconnected") return "dead";
	if (entity.health === "fault") return "danger";
	if (entity.health === "degraded") return "warn";
	if (entity.health === "stale" || entity.health === "unknown")
		return "unknown";
	if (
		snapshot.scenario === "recovery" &&
		snapshot.tasks.some((task) =>
			["accepted", "scheduled", "planning"].includes(task.state),
		)
	)
		return "start-active";
	const pressure = entity.resourceMetric
		? entity.resourceMetric.value / entity.resourceMetric.capacity
		: entity.activity;
	if (pressure < 0.05) return "idle";
	if (pressure < 0.45) return "processing-light";
	if (pressure < 0.75) return "processing";
	return "heavy-load";
}

export function entityVisualColor(entity: SceneNode): string {
	if (
		entity.visualState !== "processing-light" &&
		entity.visualState !== "processing"
	)
		return stateVisual[entity.visualState].color;
	const pressure = entity.resourceMetric
		? entity.resourceMetric.value / entity.resourceMetric.capacity
		: entity.activity;
	const fraction = Math.max(0, Math.min(1, (pressure - 0.05) / 0.7));
	const start = [0xb8, 0xf6, 0xc5];
	const end = [0x14, 0x8b, 0x49];
	return `#${start
		.map((channel, index) =>
			Math.round(channel + (end[index]! - channel) * fraction)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}
export type SceneBoundary = Snapshot["boundaries"][number] & {
	from: Point;
	to: Point;
	fromOrbit: Orbit;
	toOrbit: Orbit;
};
export type SceneTask = Snapshot["tasks"][number] & {
	position: Point;
	orbit: Orbit;
};
export type SceneStage = Snapshot["pipelines"][number]["stages"][number] & {
	pipelineId: string;
	position: Point;
	orbit: Orbit;
};
export type SceneModel = {
	entities: SceneNode[];
	boundaries: SceneBoundary[];
	tasks: SceneTask[];
	pipelines: Snapshot["pipelines"];
	stages: SceneStage[];
};

const zones: Record<Snapshot["entities"][number]["kind"], Point> = {
	system: [0, 0, -0.7],
	agent: [0, 0, 0],
	memory: [0, 0, -2.45],
	tool: [-2.45, 0, 0],
	external: [2.45, 0, 0],
	runtime: [0, 0, 2.45],
	service: [0, 0, 3.6],
	host: [-2.8, 0, 3.1],
	resource: [-3.8, 0, 4.2],
	model: [2.45, 0, 0],
	task: [-2.25, 0, -2.25],
	pipeline: [2.25, 0, -2.25],
};

const kinds = Object.keys(zones) as Array<Snapshot["entities"][number]["kind"]>;
const ORBIT_PERIOD_MS = 180_000;
const initialEntityPhaseDegrees: Record<string, number> = {
	"physical-host": 120,
	memory: 145,
	"world-model": 320,
	"physical-cpu": 65,
	"physical-load": 10,
	"physical-memory": 180,
	"physical-disk": 210,
	runtime: 335,
	asr: 335,
	backchannel: 270,
	"context-recall": 210,
	"context-search": 285,
	embedding: 90,
	llm: 70,
	sqlite: 145,
	tts: 230,
};
const initialStagePhaseDegrees: Record<string, number> = {
	finding: 240,
	covering: 345,
	finalize: 45,
	"review-queue": 140,
	"knowledge-queue": 200,
};
const defaultSymbol: Record<
	Snapshot["entities"][number]["kind"],
	EntitySymbol
> = {
	system: "orchestrator",
	agent: "orchestrator",
	memory: "brain",
	tool: "gear",
	external: "gateway",
	runtime: "server",
	service: "service",
	host: "computer",
	resource: "service",
	model: "world",
	task: "task",
	pipeline: "pipeline",
};

export function orbitalPosition(
	orbit: Orbit,
	elapsedMs: number,
	target: [number, number, number] = [0, 0, 0],
): Point {
	const angle = orbit.phase + (elapsedMs / orbit.periodMs) * Math.PI * 2;
	const flatX = Math.cos(angle) * orbit.radius;
	const flatZ = Math.sin(angle) * orbit.radius;
	const tiltedY = -flatZ * Math.sin(orbit.inclination);
	const tiltedZ = flatZ * Math.cos(orbit.inclination);
	target[0] =
		flatX * Math.cos(orbit.nodeAngle) + tiltedZ * Math.sin(orbit.nodeAngle);
	target[1] = orbit.yOffset + tiltedY;
	target[2] =
		-flatX * Math.sin(orbit.nodeAngle) + tiltedZ * Math.cos(orbit.nodeAngle);
	return target;
}

function orbitForKind(
	kind: Snapshot["entities"][number]["kind"],
	slot: number,
	total = 1,
): Orbit {
	const [x, , z] = zones[kind];
	if (kind === "resource") {
		const hostOrbit = orbitForKind("host", 0);
		return {
			...hostOrbit,
			radius: 3.75,
			inclination: [-Math.PI / 6, 0, Math.PI / 6, Math.PI / 3][slot % 4] ?? 0,
			nodeAngle: [-0.25, 0, 0.25, 0][slot % 4] ?? 0,
			phase: hostOrbit.phase + ([-1.42, -0.39, 0.66, 1.9][slot % 4] ?? 0),
			yOffset: 0,
		};
	}
	const order = kinds.indexOf(kind);
	return {
		radius:
			kind === "agent"
				? slot * 1.5
				: kind === "service"
					? 2.65 + slot * 0.12
					: Math.min(
							3.1,
							Math.hypot(x, z) + Math.floor(slot / 5) * 0.25 + (slot % 5) * 0.1,
						),
		inclination:
			kind === "agent"
				? 0
				: ([-Math.PI / 6, -Math.PI / 12, 0, Math.PI / 6, Math.PI / 3][
						(kind === "service" ? slot : order) % 5
					] ?? 0),
		nodeAngle:
			kind === "agent"
				? 0
				: ([-0.25, 0, 0.25][(kind === "service" ? slot : order) % 3] ?? 0),
		phase:
			kind === "service"
				? -Math.PI / 2 + (slot * Math.PI * 2) / total
				: Math.atan2(z, x) + (slot % 5) * 0.34,
		periodMs: ORBIT_PERIOD_MS,
		yOffset: 0,
	};
}

function slots(snapshot: Snapshot) {
	const items = snapshot.entities.filter((entity) => entity.id !== "tool");
	const previewPlanes: Record<string, [number, number]> = {
		"physical-host": [Math.PI / 6, -0.25],
		"context-recall": [-Math.PI / 6, 0.15],
		backchannel: [Math.PI / 3, 0.25],
		"world-model": [0, 0],
		"context-search": [Math.PI / 6, -0.25],
		sqlite: [-Math.PI / 6, 0.15],
	};
	const counts = new Map<string, number>();
	const totals = new Map<string, number>();
	const resourceOrder = [
		"physical-cpu",
		"physical-load",
		"physical-memory",
		"physical-disk",
	];
	for (const item of items)
		totals.set(item.kind, (totals.get(item.kind) ?? 0) + 1);
	return [...items]
		.sort(
			(a, b) =>
				a.kind.localeCompare(b.kind) ||
				(a.kind === "resource"
					? resourceOrder.indexOf(a.id) - resourceOrder.indexOf(b.id)
					: a.id.localeCompare(b.id)),
		)
		.map((item) => {
			const slot = counts.get(item.kind) ?? 0;
			counts.set(item.kind, slot + 1);
			const baseOrbit = orbitForKind(item.kind, slot, totals.get(item.kind));
			const plane = previewPlanes[item.id];
			const orbitWithPreview =
				plane === undefined
					? baseOrbit
					: {
							...baseOrbit,
							radius: item.kind === "service" ? baseOrbit.radius : 3.25,
							inclination: plane[0],
							nodeAngle: plane[1],
							yOffset: 0,
						};
			const initialPhaseDegrees = initialEntityPhaseDegrees[item.id];
			const orbit =
				initialPhaseDegrees === undefined
					? orbitWithPreview
					: {
							...orbitWithPreview,
							phase: (initialPhaseDegrees * Math.PI) / 180,
						};
			return {
				...item,
				visualState: entityVisualState(item, snapshot),
				symbol: item.symbol ?? defaultSymbol[item.kind],
				orbit,
				position: orbitalPosition(orbit, 0),
			};
		});
}

export function buildSceneModel(snapshot: Snapshot): SceneModel {
	const entities = slots(snapshot);
	const positions = new Map(
		entities.map((entity) => [entity.id, entity.position]),
	);
	const orbits = new Map(entities.map((entity) => [entity.id, entity.orbit]));
	const boundaries = [...snapshot.boundaries]
		.filter(
			(boundary) => boundary.source !== "tool" && boundary.target !== "tool",
		)
		.sort((a, b) => a.id.localeCompare(b.id))
		.map((boundary) => ({
			...boundary,
			from: positions.get(boundary.source) ?? ([0, 0, 0] as Point),
			to: positions.get(boundary.target) ?? ([0, 0, 0] as Point),
			fromOrbit: orbits.get(boundary.source) ?? orbitForKind("agent", 0),
			toOrbit: orbits.get(boundary.target) ?? orbitForKind("agent", 0),
		}));
	const tasks = [...snapshot.tasks]
		.sort((a, b) => a.id.localeCompare(b.id))
		.map((task, index) => {
			const orbit: Orbit = {
				radius: 1.65 + Math.floor(index / 4) * 0.4,
				inclination: [0, Math.PI / 6, -Math.PI / 6][index % 3] ?? 0,
				nodeAngle: [-0.25, 0, 0.25][index % 3] ?? 0,
				phase: Math.PI + index * 0.8,
				periodMs: ORBIT_PERIOD_MS,
				yOffset: 0,
			};
			return { ...task, orbit, position: orbitalPosition(orbit, 0) };
		});
	const pipelines = [...snapshot.pipelines].sort((a, b) =>
		a.id.localeCompare(b.id),
	);
	const stages = pipelines.flatMap((pipeline, pipelineIndex) =>
		pipeline.stages.map((stage, index) => {
			const orbit: Orbit = {
				radius: 3.55 + index * 0.05 + pipelineIndex * 0.2,
				inclination:
					[-Math.PI / 6, -Math.PI / 12, 0, Math.PI / 6, Math.PI / 3][
						index % 5
					] ?? 0,
				nodeAngle: [-0.25, 0, 0.25, -0.25, 0.25][index % 5] ?? 0,
				phase:
					pipelineIndex === 0 &&
					initialStagePhaseDegrees[stage.id] !== undefined
						? ((initialStagePhaseDegrees[stage.id] ?? 0) * Math.PI) / 180
						: -Math.PI / 2 + (index * Math.PI * 2) / pipeline.stages.length,
				periodMs: ORBIT_PERIOD_MS,
				yOffset: 0,
			};
			return {
				...stage,
				pipelineId: pipeline.id,
				orbit,
				position: orbitalPosition(orbit, 0),
			};
		}),
	);
	return { entities, boundaries, tasks, pipelines, stages };
}

export function selectionFromClick(
	current: Selection,
	target: NonNullable<Selection>,
): Selection {
	if (!current) return target;
	return null;
}

export function selectionExists(
	model: SceneModel,
	selection: Selection,
): boolean {
	if (!selection) return false;
	if (selection.kind === "entity")
		return model.entities.some((item) => item.id === selection.id);
	if (selection.kind === "boundary")
		return model.boundaries.some((item) => item.id === selection.id);
	if (selection.kind === "task")
		return model.tasks.some((item) => item.id === selection.id);
	if (selection.kind === "pipeline")
		return model.pipelines.some((item) => item.id === selection.id);
	return model.stages.some(
		(item) =>
			item.pipelineId === selection.pipelineId && item.id === selection.id,
	);
}

export const healthVisual: Record<
	Health,
	{ color: string; label: string; pattern: string }
> = {
	healthy: { color: "#61d6bd", label: "Healthy", pattern: "solid" },
	degraded: { color: "#ffbd69", label: "Degraded", pattern: "dashed" },
	stale: { color: "#a3aac4", label: "Stale", pattern: "dim" },
	disconnected: { color: "#8290a2", label: "Disconnected", pattern: "broken" },
	fault: { color: "#ff6b7b", label: "Fault", pattern: "warning" },
	unknown: { color: "#d9dcdf", label: "Unknown", pattern: "outline" },
};
