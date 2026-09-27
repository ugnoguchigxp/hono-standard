import type { Snapshot } from "@shared/schemas/observatory";

type ResourceMetric = NonNullable<
	Snapshot["entities"][number]["resourceMetric"]
>;

export function formatResourceMetric(metric: ResourceMetric): string {
	if (metric.type === "cpu")
		return `${Math.round(metric.value * 100)}% CPU usage`;
	if (metric.type === "load")
		return `${metric.value.toFixed(2)} / ${metric.load5?.toFixed(2) ?? "–"} / ${metric.load15?.toFixed(2) ?? "–"} load (1 / 5 / 15 min), ${metric.capacity} logical cores`;
	const used = (metric.value / 1024 ** 3).toFixed(1);
	const total = (metric.capacity / 1024 ** 3).toFixed(1);
	return `${used} / ${total} GiB (${Math.round((metric.value / metric.capacity) * 100)}%)`;
}
