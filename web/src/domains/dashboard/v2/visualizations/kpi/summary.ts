import type { KpiModel } from "./model";
import { stateToken } from "./state";

export function kpiSummary(model: KpiModel, label = "KPI"): string {
	if (model.error || !model.items.length) return `${label}: No data`;
	const describe = (item: KpiModel["items"][number], prefix = item.label) => {
		const parts = [`${prefix}: ${item.formatted.current ?? "—"}`];
		if (item.formatted.previous)
			parts.push(`previous ${item.formatted.previous}`);
		if (item.formatted.delta)
			parts.push(`delta ${item.formatted.delta} ${item.sentiment}`);
		if (item.formatted.goal) parts.push(`goal ${item.formatted.goal}`);
		parts.push(item.state);
		if (item.overflow) parts.push(`range ${item.overflow}`);
		return parts.join(", ");
	};
	if (model.items.length === 1)
		return describe(model.items[0], label).slice(0, 1000);
	const counts = model.items.reduce<Record<string, number>>((result, item) => {
		result[item.state] = (result[item.state] ?? 0) + 1;
		return result;
	}, {});
	const countText = Object.entries(counts)
		.map(([state, count]) => `${count} ${state}`)
		.join(", ");
	const preview = model.items
		.slice(0, 5)
		.map((item) => describe(item))
		.join("; ");
	const remaining =
		model.items.length > 5 ? `; ${model.items.length - 5} more` : "";
	return `${label}: ${model.items.length} items (${countText}); ${preview}${remaining}`.slice(
		0,
		1000,
	);
}

export { stateToken };
