import type { TraceSpan } from "./trace-model";

export function traceCriticalPath(spans: TraceSpan[]) {
	const byId = new Map(spans.map((span) => [span.key, span]));
	let best: TraceSpan[] = [];
	const duration = (items: TraceSpan[]) =>
		items.reduce((sum, item) => sum + item.duration, 0);
	const pathKey = (items: TraceSpan[]) =>
		items.map((item) => item.key).join("→");
	const walk = (span: TraceSpan, current: TraceSpan[]) => {
		const next = [...current, span];
		if (
			duration(next) > duration(best) ||
			(duration(next) === duration(best) && pathKey(next) < pathKey(best))
		)
			best = next;
		for (const child of span.children) {
			const nextSpan = byId.get(child);
			if (nextSpan) walk(nextSpan, next);
		}
	};
	for (const span of spans.filter((item) => !item.parentSpanId)) walk(span, []);
	return best.map((span) => span.key);
}
