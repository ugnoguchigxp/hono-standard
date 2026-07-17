import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { SPECIALIZED_LIMITS } from "../specialized/limits";
import {
	fieldFor,
	numberAt,
	rowCount,
	stringAt,
} from "../specialized/frame-values";
import { sanitizeDisplayText } from "../specialized/text";

export type GraphNode = {
	id: string;
	label: string;
	category?: string;
	state?: string;
	value?: number;
	x?: number;
	y?: number;
	index: number;
};
export type GraphEdge = {
	source: string;
	target: string;
	label?: string;
	value?: number;
	state?: string;
	selfLoop: boolean;
	index: number;
};
export type GraphModel = {
	nodes: GraphNode[];
	edges: GraphEdge[];
	sccs: string[][];
	criticalComponents: string[][];
	criticalPath: string[];
	notices: string[];
};

export function buildGraphModel(
	nodesFrame: DashboardDataFrameV2,
	edgesFrame: DashboardDataFrameV2,
	preset = "dependency",
): GraphModel {
	const idField = fieldFor(nodesFrame, "id");
	if (!idField) throw new Error("graph nodes require an id field");
	const labelField = fieldFor(nodesFrame, "label");
	const categoryField = fieldFor(nodesFrame, "category");
	const stateField = fieldFor(nodesFrame, "state");
	const valueField = fieldFor(nodesFrame, "value");
	const xField = fieldFor(nodesFrame, "x");
	const yField = fieldFor(nodesFrame, "y");
	const nodes: GraphNode[] = [];
	const ids = new Set<string>();
	for (let index = 0; index < rowCount(nodesFrame); index += 1) {
		const id = stringAt(idField, index);
		if (!id) throw new Error("graph node id is required");
		if (ids.has(id)) throw new Error("graph node ids must be unique");
		ids.add(id);
		const x = numberAt(xField, index);
		const y = numberAt(yField, index);
		if ((x === undefined) !== (y === undefined))
			throw new Error("graph coordinates must be complete pairs");
		const rawLabel = stringAt(labelField, index, id);
		if (rawLabel.length > 256)
			throw new Error("graph node label limit exceeded");
		nodes.push({
			id,
			label: sanitizeDisplayText(rawLabel),
			category: categoryField
				? sanitizeDisplayText(stringAt(categoryField, index)) || undefined
				: undefined,
			state: stateField
				? sanitizeDisplayText(stringAt(stateField, index)) || undefined
				: undefined,
			value: numberAt(valueField, index),
			x,
			y,
			index,
		});
	}
	if (nodes.length > SPECIALIZED_LIMITS.maxNodes)
		throw new Error("graph node limit exceeded");
	const sourceField = fieldFor(edgesFrame, "source");
	const targetField = fieldFor(edgesFrame, "target");
	if (!sourceField || !targetField)
		throw new Error("graph edges require source and target fields");
	const labelEdgeField = fieldFor(edgesFrame, "label");
	const edgeValueField = fieldFor(edgesFrame, "value");
	const edgeStateField = fieldFor(edgesFrame, "state");
	const edges: GraphEdge[] = [];
	const edgeKeys = new Set<string>();
	for (let index = 0; index < rowCount(edgesFrame); index += 1) {
		const source = stringAt(sourceField, index);
		const target = stringAt(targetField, index);
		if (!ids.has(source) || !ids.has(target))
			throw new Error("graph edge endpoint is missing");
		const label = labelEdgeField ? stringAt(labelEdgeField, index) : "";
		const selfLoop = source === target;
		if (selfLoop && preset !== "directed")
			throw new Error("self-loops are only supported by directed preset");
		const key = `${source}\u0000${target}\u0000${label}`;
		if (edgeKeys.has(key)) throw new Error("duplicate graph edge");
		edgeKeys.add(key);
		const value = numberAt(edgeValueField, index);
		if (value !== undefined && value < 0)
			throw new Error("graph edge value must be non-negative");
		edges.push({
			source,
			target,
			label: label ? sanitizeDisplayText(label) : undefined,
			value,
			state: edgeStateField
				? sanitizeDisplayText(stringAt(edgeStateField, index)) || undefined
				: undefined,
			selfLoop,
			index,
		});
	}
	if (edges.length > SPECIALIZED_LIMITS.maxEdges)
		throw new Error("graph edge limit exceeded");
	const coordinates = nodes.every(
		(node) => node.x !== undefined && node.y !== undefined,
	);
	if (
		!coordinates &&
		nodes.some((node) => node.x !== undefined || node.y !== undefined)
	)
		throw new Error("partial graph coordinates are not supported");
	const sccs = stronglyConnectedComponents(nodes, edges);
	const criticalComponents = computeCriticalComponents(nodes, edges, sccs);
	const criticalPath = criticalComponents.flat();
	return {
		nodes,
		edges,
		sccs,
		criticalComponents,
		criticalPath,
		notices: sccs.some((scc) => scc.length > 1)
			? ["cycle rendered as strongly connected component"]
			: [],
	};
}

export function stronglyConnectedComponents(
	nodes: GraphNode[],
	edges: GraphEdge[],
) {
	const adjacency = new Map(nodes.map((node) => [node.id, [] as string[]]));
	for (const edge of edges) adjacency.get(edge.source)?.push(edge.target);
	for (const values of adjacency.values()) values.sort();
	let index = 0;
	const stack: string[] = [];
	const onStack = new Set<string>();
	const indices = new Map<string, number>();
	const low = new Map<string, number>();
	const result: string[][] = [];
	const visit = (id: string) => {
		indices.set(id, index);
		low.set(id, index);
		index += 1;
		stack.push(id);
		onStack.add(id);
		for (const next of adjacency.get(id) ?? []) {
			if (!indices.has(next)) {
				visit(next);
				const currentLow = low.get(id);
				const nextLow = low.get(next);
				if (currentLow !== undefined && nextLow !== undefined)
					low.set(id, Math.min(currentLow, nextLow));
			} else if (onStack.has(next)) {
				const currentLow = low.get(id);
				const nextIndex = indices.get(next);
				if (currentLow !== undefined && nextIndex !== undefined)
					low.set(id, Math.min(currentLow, nextIndex));
			}
		}
		if (low.get(id) === indices.get(id)) {
			const component: string[] = [];
			let current = "";
			do {
				const popped = stack.pop();
				if (!popped) break;
				current = popped;
				onStack.delete(current);
				component.push(current);
			} while (current !== id);
			result.push(component.sort());
		}
	};
	for (const node of [...nodes].sort((a, b) => a.id.localeCompare(b.id)))
		if (!indices.has(node.id)) visit(node.id);
	return result.sort((a, b) => (a[0] ?? "").localeCompare(b[0] ?? ""));
}

export function computeCriticalPath(
	nodes: GraphNode[],
	edges: GraphEdge[],
	sccs = stronglyConnectedComponents(nodes, edges),
) {
	return computeCriticalComponents(nodes, edges, sccs).flat();
}

export function computeCriticalComponents(
	nodes: GraphNode[],
	edges: GraphEdge[],
	sccs = stronglyConnectedComponents(nodes, edges),
) {
	const componentOf = new Map<string, number>();
	for (const [index, scc] of sccs.entries())
		for (const id of scc) componentOf.set(id, index);
	const nodeById = new Map(nodes.map((node) => [node.id, node]));
	const outgoing = new Map<number, Array<{ to: number; weight: number }>>();
	const adjacency = new Map<number, Set<number>>();
	const indegree = new Map(sccs.map((_, index) => [index, 0]));
	for (const edge of edges) {
		const from = componentOf.get(edge.source);
		const to = componentOf.get(edge.target);
		if (from === undefined || to === undefined) continue;
		if (from !== to) {
			const weight = edge.value ?? nodeById.get(edge.target)?.value ?? 1;
			outgoing.set(from, [...(outgoing.get(from) ?? []), { to, weight }]);
			const targets = adjacency.get(from) ?? new Set<number>();
			if (!targets.has(to)) {
				targets.add(to);
				adjacency.set(from, targets);
				indegree.set(to, (indegree.get(to) ?? 0) + 1);
			}
		}
	}
	const componentKey = (component: number) => (sccs[component] ?? []).join("/");
	const queue = [...sccs.keys()]
		.filter((component) => (indegree.get(component) ?? 0) === 0)
		.sort((a, b) => componentKey(a).localeCompare(componentKey(b)));
	const order: number[] = [];
	while (queue.length > 0) {
		const component = queue.shift();
		if (component === undefined) break;
		order.push(component);
		for (const target of [...(adjacency.get(component) ?? [])].sort((a, b) =>
			componentKey(a).localeCompare(componentKey(b)),
		)) {
			indegree.set(target, (indegree.get(target) ?? 1) - 1);
			if (indegree.get(target) === 0) {
				queue.push(target);
				queue.sort((a, b) => componentKey(a).localeCompare(componentKey(b)));
			}
		}
	}
	const score = new Map<number, number>();
	const path = new Map<number, number[]>();
	const pathKey = (components: number[]) =>
		components.map(componentKey).join("→");
	for (const component of order) {
		if (!score.has(component)) {
			score.set(component, 0);
			path.set(component, [component]);
		}
		for (const edge of [...(outgoing.get(component) ?? [])].sort(
			(a, b) =>
				componentKey(a.to).localeCompare(componentKey(b.to)) ||
				b.weight - a.weight,
		)) {
			const candidate = (score.get(component) ?? 0) + edge.weight;
			if (!Number.isFinite(candidate))
				throw new Error("graph critical path weight exceeds numeric range");
			const candidatePath = [...(path.get(component) ?? []), edge.to];
			const existing = path.get(edge.to);
			if (
				!existing ||
				candidate > (score.get(edge.to) ?? -Infinity) ||
				(candidate === score.get(edge.to) &&
					pathKey(candidatePath) < pathKey(existing))
			) {
				score.set(edge.to, candidate);
				path.set(edge.to, candidatePath);
			}
		}
	}
	const best = [...path.entries()].sort(
		([leftComponent, leftPath], [rightComponent, rightPath]) =>
			(score.get(rightComponent) ?? 0) - (score.get(leftComponent) ?? 0) ||
			pathKey(leftPath).localeCompare(pathKey(rightPath)),
	)[0]?.[1];
	return (best ?? []).map((component) => [...(sccs[component] ?? [])]);
}
