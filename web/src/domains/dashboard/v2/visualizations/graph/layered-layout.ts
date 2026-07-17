import {
	stronglyConnectedComponents,
	type GraphEdge,
	type GraphNode,
} from "./graph-model";

export type GraphPosition = GraphNode & {
	px: number;
	py: number;
	rank: number;
};

export function buildLayeredLayout(
	nodes: GraphNode[],
	edges: GraphEdge[],
	width = 720,
	height = 360,
	orientation: "left-right" | "top-bottom" = "left-right",
): GraphPosition[] {
	if (
		nodes.length > 0 &&
		nodes.every((node) => node.x !== undefined && node.y !== undefined)
	) {
		const xs = nodes.map((node) => node.x as number);
		const ys = nodes.map((node) => node.y as number);
		const minX = Math.min(...xs);
		const maxX = Math.max(...xs);
		const minY = Math.min(...ys);
		const maxY = Math.max(...ys);
		return nodes.map((node) => ({
			...node,
			rank: 0,
			px: (((node.x ?? 0) - minX) / Math.max(1e-9, maxX - minX)) * width,
			py: (((node.y ?? 0) - minY) / Math.max(1e-9, maxY - minY)) * height,
		}));
	}
	const sccs = stronglyConnectedComponents(nodes, edges);
	const componentOf = new Map<string, number>();
	for (const [component, ids] of sccs.entries())
		for (const id of ids) componentOf.set(id, component);
	const componentKey = (component: number) => (sccs[component] ?? []).join("/");
	const indegree = new Map(sccs.map((_, index) => [index, 0]));
	const outgoing = new Map<number, Set<number>>();
	for (const edge of edges) {
		const source = componentOf.get(edge.source);
		const target = componentOf.get(edge.target);
		if (source === undefined || target === undefined || source === target)
			continue;
		const targets = outgoing.get(source) ?? new Set<number>();
		if (!targets.has(target)) {
			targets.add(target);
			outgoing.set(source, targets);
			indegree.set(target, (indegree.get(target) ?? 0) + 1);
		}
	}
	const rank = new Map(sccs.map((_, index) => [index, 0]));
	const queue = [...sccs.keys()]
		.filter((component) => (indegree.get(component) ?? 0) === 0)
		.sort((a, b) => componentKey(a).localeCompare(componentKey(b)));
	while (queue.length > 0) {
		const component = queue.shift();
		if (component === undefined) break;
		for (const target of [...(outgoing.get(component) ?? [])].sort((a, b) =>
			componentKey(a).localeCompare(componentKey(b)),
		)) {
			rank.set(
				target,
				Math.max(rank.get(target) ?? 0, (rank.get(component) ?? 0) + 1),
			);
			indegree.set(target, (indegree.get(target) ?? 1) - 1);
			if (indegree.get(target) === 0) {
				queue.push(target);
				queue.sort((a, b) => componentKey(a).localeCompare(componentKey(b)));
			}
		}
	}
	const maxRank = Math.max(0, ...rank.values());
	const componentsByRank = new Map<number, number[]>();
	for (const component of [...sccs.keys()].sort((a, b) =>
		componentKey(a).localeCompare(componentKey(b)),
	)) {
		const componentRank = rank.get(component) ?? 0;
		componentsByRank.set(componentRank, [
			...(componentsByRank.get(componentRank) ?? []),
			component,
		]);
	}
	const nodeById = new Map(nodes.map((node) => [node.id, node]));
	const positions = new Map<string, GraphPosition>();
	for (const [component, ids] of sccs.entries()) {
		const componentRank = rank.get(component) ?? 0;
		const rankGroup = componentsByRank.get(componentRank) ?? [component];
		const groupIndex = rankGroup.indexOf(component);
		const primary = (componentRank + 1) / (maxRank + 2);
		const secondary = (groupIndex + 1) / (rankGroup.length + 1);
		const centerX =
			(orientation === "left-right" ? primary : secondary) * width;
		const centerY =
			(orientation === "left-right" ? secondary : primary) * height;
		const radius = ids.length > 1 ? Math.min(20, 6 + ids.length * 2) : 0;
		for (const [index, id] of ids.entries()) {
			const node = nodeById.get(id);
			if (!node) continue;
			const angle = ids.length > 1 ? (index / ids.length) * Math.PI * 2 : 0;
			positions.set(id, {
				...node,
				rank: componentRank,
				px: centerX + Math.cos(angle) * radius,
				py: centerY + Math.sin(angle) * radius,
			});
		}
	}
	return nodes.flatMap((node) => {
		const position = positions.get(node.id);
		return position ? [position] : [];
	});
}
