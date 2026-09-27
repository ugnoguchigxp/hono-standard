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
	position: Point;
	orbit: Orbit;
};
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
	const [x, y, z] = zones[kind];
	if (kind === "resource") {
		const hostOrbit = orbitForKind("host", 0);
		return {
			...hostOrbit,
			radius: hostOrbit.radius + 1.55,
			phase: hostOrbit.phase + [-0.44, -0.15, 0.15, 0.44][slot % 4]!,
			yOffset: hostOrbit.yOffset + (slot % 2 ? 0.25 : -0.2),
		};
	}
	const order = kinds.indexOf(kind);
	return {
		radius:
			kind === "agent"
				? slot * 1.5
				: kind === "service"
					? 3.6
					: Math.hypot(x, z) + Math.floor(slot / 5) * 0.65 + (slot % 5) * 0.13,
		inclination:
			kind === "agent"
				? 0
				: (order % 2 === 0 ? 1 : -1) * (0.12 + (order % 4) * 0.065),
		nodeAngle: kind === "agent" ? 0 : ((order * 0.37) % 1.2) - 0.6,
		phase:
			kind === "service"
				? -Math.PI / 2 + (slot * Math.PI * 2) / total
				: Math.atan2(z, x) + (slot % 5) * 0.34,
		periodMs:
			kind === "service" ? 180_000 : 105_000 + order * 9_000 + slot * 3_000,
		yOffset: y,
	};
}

function slots(items: Snapshot["entities"]) {
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
			const orbit = orbitForKind(item.kind, slot, totals.get(item.kind));
			return {
				...item,
				symbol: item.symbol ?? defaultSymbol[item.kind],
				orbit,
				position: orbitalPosition(orbit, 0),
			};
		});
}

export function buildSceneModel(snapshot: Snapshot): SceneModel {
	const entities = slots(snapshot.entities);
	const positions = new Map(
		entities.map((entity) => [entity.id, entity.position]),
	);
	const orbits = new Map(entities.map((entity) => [entity.id, entity.orbit]));
	const boundaries = [...snapshot.boundaries]
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
				inclination: 0.18 + (index % 3) * 0.1,
				nodeAngle: index * 0.32,
				phase: Math.PI + index * 0.8,
				periodMs: 70_000 + index * 5_000,
				yOffset: 0.25,
			};
			return { ...task, orbit, position: orbitalPosition(orbit, 0) };
		});
	const pipelines = [...snapshot.pipelines].sort((a, b) =>
		a.id.localeCompare(b.id),
	);
	const stages = pipelines.flatMap((pipeline, pipelineIndex) =>
		pipeline.stages.map((stage, index) => {
			const orbit: Orbit = {
				radius: 5.1 + index * 0.15 + pipelineIndex * 1.4,
				inclination: [-0.32, 0.2, -0.16, 0.34, -0.25][index % 5] ?? 0,
				nodeAngle: [-0.28, 0.34, 0.72, -0.55, 0.48][index % 5] ?? 0,
				phase: -Math.PI / 2 + (index * Math.PI * 2) / pipeline.stages.length,
				periodMs: stage.kind === "step" ? 140_000 : 125_000 + index * 8_000,
				yOffset: 0.2,
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
