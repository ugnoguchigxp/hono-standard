import { formatResourceMetric } from "./resource-format";
import { stateVisual, type SceneModel, type Selection } from "./scene-model";

export type Inspection = {
	title: string;
	kind: string;
	rows: { label: string; value: string }[];
};

const time = (value: number) => new Date(value).toLocaleString();
const percent = (value: number) => `${Math.round(value * 100)}%`;
const gib = (value: number) => `${(value / 1024 ** 3).toFixed(1)} GiB`;

export function inspectionDetails(
	model: SceneModel,
	selected: Selection,
): Inspection | null {
	if (!selected) return null;
	if (selected.kind === "entity") {
		const entity = model.entities.find((item) => item.id === selected.id);
		if (!entity) return null;
		const rows = [
			{ label: "ID", value: entity.id },
			{ label: "Type", value: entity.kind },
			{ label: "Represents", value: entity.description ?? entity.kind },
			{ label: "Visual state", value: stateVisual[entity.visualState].label },
			{ label: "Health", value: entity.health },
			{ label: "Activity", value: percent(entity.activity) },
			{ label: "Symbol", value: entity.symbol },
			{ label: "Expected interval", value: `${entity.expectedIntervalMs} ms` },
			{ label: "Last seen", value: time(entity.lastSeenAt) },
		];
		if (entity.diagnosisId)
			rows.push({ label: "Diagnosis check", value: entity.diagnosisId });
		if (entity.resourceMetric)
			rows.push({
				label: "Measurement",
				value: formatResourceMetric(entity.resourceMetric),
			});
		if (entity.hostMetrics) {
			const host = entity.hostMetrics;
			rows.push(
				{
					label: "CPU",
					value: `${percent(host.cpuUsage)} / ${host.logicalCores} logical cores`,
				},
				{
					label: "Load 1 / 5 / 15 min",
					value: `${host.load1.toFixed(2)} / ${host.load5.toFixed(2)} / ${host.load15.toFixed(2)}`,
				},
				{
					label: "Memory",
					value: `${gib(host.memoryUsedBytes)} / ${gib(host.memoryTotalBytes)}`,
				},
				{
					label: "Disk",
					value: `${gib(host.diskUsedBytes)} / ${gib(host.diskTotalBytes)}`,
				},
			);
		}
		return { title: entity.label, kind: "ENTITY", rows };
	}
	if (selected.kind === "boundary") {
		const boundary = model.boundaries.find((item) => item.id === selected.id);
		if (!boundary) return null;
		const label = (id: string) =>
			model.entities.find((item) => item.id === id)?.label ?? id;
		return {
			title: `${label(boundary.source)} → ${label(boundary.target)}`,
			kind: "CONNECTION",
			rows: [
				{ label: "ID", value: boundary.id },
				{
					label: "Source",
					value: `${label(boundary.source)} (${boundary.source})`,
				},
				{
					label: "Target",
					value: `${label(boundary.target)} (${boundary.target})`,
				},
				{ label: "Health", value: boundary.health },
				{ label: "Activity", value: percent(boundary.activity) },
				{ label: "Latency", value: `${boundary.latencyMs} ms` },
				{
					label: "Expected interval",
					value: `${boundary.expectedIntervalMs} ms`,
				},
				{ label: "Last seen", value: time(boundary.lastSeenAt) },
			],
		};
	}
	if (selected.kind === "task") {
		const task = model.tasks.find((item) => item.id === selected.id);
		if (!task) return null;
		return {
			title: task.label,
			kind: "TASK",
			rows: [
				{ label: "ID", value: task.id },
				{ label: "State", value: task.state },
				{ label: "Current action", value: task.currentAction || "None" },
				{ label: "Updated", value: time(task.updatedAt) },
				{ label: "Completed steps", value: `${task.completedSteps.length}` },
				...task.completedSteps.map((step, index) => ({
					label: `${index + 1}.`,
					value: step,
				})),
			],
		};
	}
	if (selected.kind === "pipeline") {
		const pipeline = model.pipelines.find((item) => item.id === selected.id);
		if (!pipeline) return null;
		return {
			title: pipeline.label,
			kind: "PIPELINE",
			rows: [
				{ label: "ID", value: pipeline.id },
				{ label: "Stages", value: `${pipeline.stages.length}` },
				...pipeline.stages.map((stage) => ({
					label: stage.label,
					value: `${stage.kind} · ${stage.status} · queue ${stage.queueDepth}${stage.activeTaskId ? ` · ${stage.activeTaskId}` : ""}`,
				})),
				{ label: "Links", value: `${pipeline.links.length}` },
				...pipeline.links.map((link) => ({
					label: "Flow",
					value: `${link.source} → ${link.target}`,
				})),
			],
		};
	}
	const stage = model.stages.find(
		(item) =>
			item.pipelineId === selected.pipelineId && item.id === selected.id,
	);
	if (!stage) return null;
	const pipeline = model.pipelines.find((item) => item.id === stage.pipelineId);
	return {
		title: stage.label,
		kind: stage.kind === "queue" ? "QUEUE" : "STAGE",
		rows: [
			{ label: "ID", value: stage.id },
			{
				label: "Pipeline",
				value: `${pipeline?.label ?? stage.pipelineId} (${stage.pipelineId})`,
			},
			{ label: "Type", value: stage.kind },
			{ label: "Status", value: stage.status },
			{ label: "Active task", value: stage.activeTaskId ?? "None" },
			{ label: "Queue depth", value: `${stage.queueDepth}` },
		],
	};
}
