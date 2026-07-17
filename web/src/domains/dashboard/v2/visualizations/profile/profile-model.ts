import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { SPECIALIZED_LIMITS } from "../specialized/limits";
import {
	fieldFor,
	numberAt,
	rowCount,
	stringAt,
} from "../specialized/frame-values";
import { sanitizeDisplayText } from "../specialized/text";

export type ProfileNode = {
	id: string;
	parentId?: string;
	label: string;
	total: number;
	self?: number;
	delta?: number;
	category?: string;
	depth: number;
	children: string[];
	synthetic?: boolean;
};

export function buildProfileModel(
	frame: DashboardDataFrameV2,
	preset = "flame",
) {
	const id = fieldFor(frame, "id");
	const parent = fieldFor(frame, "parent-id");
	const label = fieldFor(frame, "label");
	const total = fieldFor(frame, "total");
	const self = fieldFor(frame, "self");
	const delta = fieldFor(frame, "delta");
	const category = fieldFor(frame, "category");
	if (!id || !label || !total)
		throw new Error("profile requires id/label/total fields");
	const nodes: ProfileNode[] = [];
	const byId = new Map<string, ProfileNode>();
	if (rowCount(frame) > SPECIALIZED_LIMITS.maxProfileNodes)
		throw new Error("profile node limit exceeded");
	for (let index = 0; index < rowCount(frame); index += 1) {
		const nodeId = stringAt(id, index);
		const nodeLabel = stringAt(label, index);
		const value = numberAt(total, index);
		const selfValue = numberAt(self, index);
		if (
			!nodeId ||
			!nodeLabel ||
			value === undefined ||
			value < 0 ||
			(selfValue !== undefined && selfValue < 0) ||
			byId.has(nodeId)
		)
			throw new Error("profile node values are invalid");
		const node: ProfileNode = {
			id: nodeId,
			parentId: parent ? stringAt(parent, index) || undefined : undefined,
			label: sanitizeDisplayText(nodeLabel),
			total: value,
			self: selfValue,
			delta: numberAt(delta, index),
			category: category
				? sanitizeDisplayText(stringAt(category, index))
				: undefined,
			depth: 0,
			children: [],
		};
		byId.set(nodeId, node);
		nodes.push(node);
	}
	for (const node of nodes)
		if (node.parentId) {
			const parentNode = byId.get(node.parentId);
			if (!parentNode) throw new Error("profile parent is missing");
			parentNode.children.push(node.id);
		}
	const roots = nodes.filter((node) => !node.parentId);
	const visiting = new Set<string>();
	const visited = new Set<string>();
	const visit = (node: ProfileNode, depth: number) => {
		if (visiting.has(node.id)) throw new Error("profile cycle detected");
		if (depth >= SPECIALIZED_LIMITS.maxProfileDepth)
			throw new Error("profile depth limit exceeded");
		if (visited.has(node.id)) return;
		visiting.add(node.id);
		node.depth = depth;
		const children = [...node.children].sort();
		const childTotal = children.reduce(
			(sum, id) => sum + (byId.get(id)?.total ?? 0),
			0,
		);
		const tolerance = Math.max(1e-6, Math.abs(node.total) * 1e-6);
		if (childTotal > node.total + tolerance)
			throw new Error("profile parent total is smaller than child total");
		if (
			node.self !== undefined &&
			Math.abs(node.total - childTotal - node.self) > tolerance
		)
			throw new Error("profile self time does not match children");
		for (const child of children) {
			const childNode = byId.get(child);
			if (childNode) visit(childNode, depth + 1);
		}
		visiting.delete(node.id);
		visited.add(node.id);
	};
	for (const root of roots.sort((a, b) => a.id.localeCompare(b.id)))
		visit(root, 0);
	if (roots.length === 0 || visited.size !== nodes.length)
		throw new Error("profile contains orphan");
	let syntheticId = "__all__";
	while (byId.has(syntheticId)) syntheticId = `_${syntheticId}`;
	const synthetic =
		roots.length > 1
			? ({
					id: syntheticId,
					label: "All",
					total: roots.reduce((sum, node) => sum + node.total, 0),
					depth: -1,
					children: roots.map((node) => node.id),
					synthetic: true,
				} as ProfileNode)
			: undefined;
	const allNodes = synthetic ? [synthetic, ...nodes] : nodes;
	return {
		roots,
		nodes: allNodes,
		rawNodes: nodes,
		syntheticRoot: synthetic,
		notices: synthetic
			? ["multiple profile roots grouped under synthetic All"]
			: [],
		preset,
	};
}
