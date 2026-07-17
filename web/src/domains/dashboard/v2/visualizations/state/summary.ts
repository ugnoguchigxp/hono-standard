import type { StateInterval } from "./interval-model";
import type { StateSample } from "./sample-model";
import type { UptimeBucket } from "./uptime-model";

export function timelineSummary(intervals: StateInterval[], gaps = 0) {
	const current = [...intervals].sort(
		(a, b) => b.end - a.end || b.start - a.start,
	)[0];
	const longest = [...intervals].sort((a, b) => b.durationMs - a.durationMs)[0];
	const criticalMs = intervals
		.filter((item) => item.state.semantic === "critical")
		.reduce((total, item) => total + item.durationMs, 0);
	return `Current ${current?.state.text ?? "unknown"}; longest ${longest?.durationMs ?? 0}ms; critical duration ${criticalMs}ms; missing gaps ${gaps}`.slice(
		0,
		1000,
	);
}
export function historySummary(samples: StateSample[]) {
	const counts = new Map<string, number>();
	for (const sample of samples)
		counts.set(sample.state.text, (counts.get(sample.state.text) ?? 0) + 1);
	return `States ${[...counts.entries()].map(([key, value]) => `${key}: ${value}`).join(", ")}; latest ${samples.at(-1)?.state.text ?? "unknown"}; missing ${samples.filter((sample) => sample.missing).length}`.slice(
		0,
		1000,
	);
}
export function uptimeSummary(buckets: UptimeBucket[]) {
	const valid = buckets.filter((bucket) => bucket.uptimeRatio !== null);
	const observedMs = valid.reduce((sum, bucket) => sum + bucket.observedMs, 0);
	const healthyMs = valid.reduce((sum, bucket) => sum + bucket.healthyMs, 0);
	const uptime = observedMs > 0 ? healthyMs / observedMs : null;
	const totalDuration = buckets.reduce(
		(sum, bucket) => sum + (bucket.end - bucket.start),
		0,
	);
	const allObservedMs = buckets.reduce(
		(sum, bucket) => sum + bucket.observedMs,
		0,
	);
	const coverage = totalDuration > 0 ? allObservedMs / totalDuration : 0;
	return `Uptime ${uptime === null ? "insufficient data" : `${(uptime * 100).toFixed(2)}%`}; coverage ${(coverage * 100).toFixed(1)}%; incidents ${buckets.reduce((sum, bucket) => sum + (bucket.incidentCount ?? 0), 0)}`.slice(
		0,
		1000,
	);
}
