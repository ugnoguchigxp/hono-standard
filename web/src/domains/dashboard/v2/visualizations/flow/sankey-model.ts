import type {
	DashboardDataFrameV2,
	DashboardColorToken,
} from "@shared/schemas/dashboard.schema";
import { stableToken } from "../composition/category-model";

export type SankeyModel = {
	nodes: Array<{
		id: string;
		name: string;
		group?: string;
		colorToken: DashboardColorToken;
	}>;
	links: Array<{
		source: number;
		target: number;
		value: number;
		sourceId: string;
		targetId: string;
	}>;
	totalFlow: number;
};

export function buildSankeyModel(
	nodesFrame: DashboardDataFrameV2,
	edgesFrame: DashboardDataFrameV2,
	palette: readonly string[],
): SankeyModel {
	const id = nodesFrame.fields.find((field) => field.roles.includes("id"));
	const label = nodesFrame.fields.find((field) =>
		field.roles.includes("category"),
	);
	const group = nodesFrame.fields.find((field) =>
		field.roles.includes("series"),
	);
	const source = edgesFrame.fields.find((field) =>
		field.roles.includes("source"),
	);
	const target = edgesFrame.fields.find((field) =>
		field.roles.includes("target"),
	);
	const value = edgesFrame.fields.find((field) =>
		field.roles.includes("value"),
	);
	if (
		id?.type !== "string" ||
		!source ||
		source.type !== "string" ||
		!target ||
		target.type !== "string" ||
		!value ||
		value.type !== "number"
	)
		throw new Error("SANKEY_REQUIRED_FIELDS_MISSING");
	if (id.values.length > 100 || source.values.length > 300)
		throw new Error("SANKEY_LIMIT_EXCEEDED");
	const ids = id.values.map((item) => item ?? "");
	if (ids.some((item) => !item) || new Set(ids).size !== ids.length)
		throw new Error("SANKEY_NODE_ID_INVALID");
	const index = new Map(ids.map((item, position) => [item, position]));
	const seenEdges = new Set<string>();
	const links = source.values.map((rawSource, position) => {
		const rawTarget = target.values[position];
		const numeric = value.values[position];
		if (
			!rawSource ||
			!rawTarget ||
			!index.has(rawSource) ||
			!index.has(rawTarget)
		)
			throw new Error("SANKEY_UNKNOWN_ENDPOINT");
		if (rawSource === rawTarget) throw new Error("SANKEY_SELF_LOOP");
		if (numeric === null || !Number.isFinite(numeric) || numeric <= 0)
			throw new Error("SANKEY_VALUE_INVALID");
		const key = `${rawSource}\u0000${rawTarget}`;
		if (seenEdges.has(key)) throw new Error("SANKEY_DUPLICATE_EDGE");
		seenEdges.add(key);
		return {
			source: index.get(rawSource) as number,
			target: index.get(rawTarget) as number,
			value: numeric,
			sourceId: rawSource,
			targetId: rawTarget,
		};
	});
	const adjacency = links.reduce((map, link) => {
		const list = map.get(link.source) ?? [];
		list.push(link.target);
		map.set(link.source, list);
		return map;
	}, new Map<number, number[]>());
	const indegree = new Array(ids.length).fill(0) as number[];
	for (const link of links) indegree[link.target] += 1;
	const queue = indegree.flatMap((degree, position) =>
		degree === 0 ? [position] : [],
	);
	let visited = 0;
	while (queue.length) {
		const current = queue.shift() as number;
		visited += 1;
		for (const next of adjacency.get(current) ?? []) {
			indegree[next] -= 1;
			if (indegree[next] === 0) queue.push(next);
		}
	}
	if (visited !== ids.length) throw new Error("SANKEY_CYCLE");
	if (
		ids.some(
			(_, position) =>
				!adjacency.has(position) &&
				!links.some((link) => link.target === position),
		)
	)
		throw new Error("SANKEY_DISCONNECTED_NODE");
	const modelNodes = ids.map((item, position) => ({
		id: item,
		name: label?.values[position] ? String(label.values[position]) : item,
		...(group?.values[position]
			? { group: String(group.values[position]) }
			: {}),
		colorToken: stableToken(item, palette),
	}));
	return {
		nodes: modelNodes,
		links,
		totalFlow: links
			.filter((link) => !links.some((other) => other.target === link.source))
			.reduce((sum, link) => sum + link.value, 0),
	};
}
