import type { ProfileNode } from "./profile-model";

export type FlameRect = ProfileNode & {
	x: number;
	y: number;
	width: number;
	height: number;
	layoutDepth: number;
};

export function buildFlameLayout(
	nodes: ProfileNode[],
	root: ProfileNode,
	width = 720,
	rowHeight = 22,
	direction: "flame" | "icicle" = "flame",
	minVisibleWidthPx = 2,
	maxDepth = 64,
) {
	const byId = new Map(nodes.map((node) => [node.id, node]));
	const result: FlameRect[] = [];
	const visit = (
		node: ProfileNode,
		x: number,
		depth: number,
		allocatedWidth: number,
	) => {
		if (depth >= maxDepth) return;
		if (allocatedWidth < minVisibleWidthPx && depth > 0) return;
		result.push({
			...node,
			x,
			y: depth * rowHeight,
			width: allocatedWidth,
			height: rowHeight - 2,
			layoutDepth: depth,
		});
		let cursor = x;
		const children = node.children
			.map((childId) => byId.get(childId))
			.filter((child): child is ProfileNode => child !== undefined)
			.sort(
				(a, b) =>
					b.total - a.total ||
					a.label.localeCompare(b.label) ||
					a.id.localeCompare(b.id),
			);
		let otherX: number | undefined;
		let otherWidth = 0;
		let otherTotal = 0;
		let otherSelf = 0;
		let otherDelta = 0;
		let hasOtherDelta = false;
		for (const child of children) {
			const childWidth =
				node.total > 0 ? allocatedWidth * (child.total / node.total) : 0;
			if (childWidth < minVisibleWidthPx) {
				otherX ??= cursor;
				otherWidth += childWidth;
				otherTotal += child.total;
				otherSelf += child.self ?? 0;
				if (child.delta !== undefined) {
					hasOtherDelta = true;
					otherDelta += child.delta;
				}
			} else {
				visit(child, cursor, depth + 1, childWidth);
			}
			cursor += childWidth;
		}
		if (otherX !== undefined && otherWidth > 0 && depth + 1 < maxDepth)
			result.push({
				id: `${node.id}::__other__:${depth + 1}`,
				parentId: node.id,
				label: "Other",
				total: otherTotal,
				self: otherSelf,
				delta: hasOtherDelta ? otherDelta : undefined,
				depth: node.depth + 1,
				children: [],
				synthetic: true,
				x: otherX,
				y: (depth + 1) * rowHeight,
				width: otherWidth,
				height: rowHeight - 2,
				layoutDepth: depth + 1,
			});
	};
	visit(root, 0, 0, width);
	if (direction === "icicle") return result;
	const deepest = Math.max(0, ...result.map((item) => item.layoutDepth));
	return result.map((item) => ({
		...item,
		y: (deepest - item.layoutDepth) * rowHeight,
	}));
}
