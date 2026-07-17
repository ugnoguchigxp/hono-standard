import type {
	DashboardDataFrameV2,
	DashboardColorToken,
} from "@shared/schemas/dashboard.schema";
import { stableToken } from "../composition/category-model";

export type HierarchyNodeModel = {
	id: string;
	label: string;
	ownValue: number | null;
	value: number;
	depth: number;
	path: string[];
	colorToken: DashboardColorToken;
	children: HierarchyNodeModel[];
};
export type HierarchyModel = {
	roots: HierarchyNodeModel[];
	syntheticRoot: HierarchyNodeModel;
	nodeCount: number;
	leafCount: number;
	maxDepth: number;
};
type FlatNode = {
	id: string;
	parent: string | null;
	label: string;
	ownValue: number | null;
	index: number;
};

export function buildHierarchyModel(
	frame: DashboardDataFrameV2,
	palette: readonly string[],
	title = "Dashboard",
) {
	const idField = frame.fields.find((field) => field.roles.includes("id"));
	const parentField = frame.fields.find((field) =>
		field.roles.includes("parent-id"),
	);
	const labelField = frame.fields.find((field) =>
		field.roles.includes("category"),
	);
	const valueField = frame.fields.find((field) =>
		field.roles.includes("value"),
	);
	if (idField?.type !== "string" || !valueField || valueField.type !== "number")
		throw new Error("HIERARCHY_ID_VALUE_FIELDS_REQUIRED");
	const nodes: FlatNode[] = idField.values.map((id, index) => {
		if (!id) throw new Error("HIERARCHY_ID_REQUIRED");
		const ownValue = valueField.values[index] ?? null;
		if (ownValue !== null && (!Number.isFinite(ownValue) || ownValue <= 0))
			throw new Error("HIERARCHY_VALUE_MUST_BE_POSITIVE");
		return {
			id,
			parent: parentField?.values[index]
				? String(parentField.values[index])
				: null,
			label: labelField?.values[index] ? String(labelField.values[index]) : id,
			ownValue,
			index,
		};
	});
	if (nodes.length > 500) throw new Error("HIERARCHY_NODE_LIMIT_EXCEEDED");
	const byId = new Map<string, FlatNode>();
	for (const node of nodes) {
		if (byId.has(node.id) || node.id === "__dashboard_root__")
			throw new Error("HIERARCHY_DUPLICATE_OR_RESERVED_ID");
		byId.set(node.id, node);
	}
	for (const node of nodes)
		if (node.parent && !byId.has(node.parent))
			throw new Error("HIERARCHY_ORPHAN");
	const children = new Map<string, FlatNode[]>();
	for (const node of nodes) {
		const list = children.get(node.parent ?? "") ?? [];
		list.push(node);
		children.set(node.parent ?? "", list);
	}
	for (const [parent, list] of children)
		if (parent && list.length > 100)
			throw new Error("HIERARCHY_CHILD_LIMIT_EXCEEDED");
	const visiting = new Set<string>();
	const visited = new Set<string>();
	const build = (
		node: FlatNode,
		depth: number,
		path: string[],
		topId: string,
	): HierarchyNodeModel => {
		if (visiting.has(node.id)) throw new Error("HIERARCHY_CYCLE");
		if (depth > 6) throw new Error("HIERARCHY_DEPTH_LIMIT_EXCEEDED");
		visiting.add(node.id);
		const childModels = (children.get(node.id) ?? []).map((child) =>
			build(child, depth + 1, [...path, node.id], topId),
		);
		visiting.delete(node.id);
		visited.add(node.id);
		const derived = childModels.reduce((sum, child) => sum + child.value, 0);
		if (
			childModels.length > 0 &&
			node.ownValue !== null &&
			Math.abs(node.ownValue - derived) >
				Math.max(1e-9, Math.abs(derived) * 1e-9)
		)
			throw new Error("HIERARCHY_INTERNAL_VALUE_MISMATCH");
		return {
			id: node.id,
			label: node.label,
			ownValue: node.ownValue,
			value: childModels.length > 0 ? derived : (node.ownValue ?? 0),
			depth,
			path: [...path, node.id],
			colorToken: stableToken(topId, palette),
			children: childModels,
		};
	};
	const roots = (children.get("") ?? []).map((node) =>
		build(node, 0, [], node.id),
	);
	if (visited.size !== nodes.length) throw new Error("HIERARCHY_CYCLE");
	const syntheticRoot: HierarchyNodeModel = {
		id: "__dashboard_root__",
		label: title,
		ownValue: null,
		value: roots.reduce((sum, node) => sum + node.value, 0),
		depth: -1,
		path: [],
		colorToken: "--color-brand",
		children: roots,
	};
	const all = roots.flatMap(function flatten(node): HierarchyNodeModel[] {
		return [node, ...node.children.flatMap(flatten)];
	});
	return {
		roots,
		syntheticRoot,
		nodeCount: all.length,
		leafCount: all.filter((node) => node.children.length === 0).length,
		maxDepth: Math.max(0, ...all.map((node) => node.depth)),
	} satisfies HierarchyModel;
}
