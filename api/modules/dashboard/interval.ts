import type { DashboardRange } from "../../../shared/schemas/dashboard.schema";
import { DASHBOARD_LIMITS } from "../../../shared/schemas/dashboard.schema";
import type { ResolvedRange } from "./types";

const relativeRangeMs: Record<
	Exclude<DashboardRange, { kind: "absolute" }>["value"],
	number
> = {
	"15m": 15 * 60 * 1_000,
	"1h": 60 * 60 * 1_000,
	"6h": 6 * 60 * 60 * 1_000,
	"24h": 24 * 60 * 60 * 1_000,
	"7d": 7 * 24 * 60 * 60 * 1_000,
};

const niceIntervalsMs = [
	1_000,
	5_000,
	10_000,
	30_000,
	60_000,
	5 * 60_000,
	10 * 60_000,
	15 * 60_000,
	30 * 60_000,
	60 * 60_000,
	3 * 60 * 60_000,
	6 * 60 * 60_000,
	12 * 60 * 60_000,
	24 * 60 * 60_000,
	7 * 24 * 60 * 60_000,
];

export function resolveDashboardRange(
	range: DashboardRange,
	now: () => Date,
): ResolvedRange {
	const to = range.kind === "absolute" ? new Date(range.to) : now();
	const from =
		range.kind === "absolute"
			? new Date(range.from)
			: new Date(to.getTime() - relativeRangeMs[range.value]);
	const durationMs = to.getTime() - from.getTime();
	if (!Number.isFinite(durationMs) || durationMs <= 0)
		throw new RangeError("range must be positive");
	if (durationMs > DASHBOARD_LIMITS.maxRangeMs)
		throw new RangeError("range exceeds dashboard limit");
	return { from, to };
}

export function chooseIntervalMs(
	resolvedRange: ResolvedRange,
	maxDataPoints: number,
): number {
	const rawInterval = Math.ceil(
		(resolvedRange.to.getTime() - resolvedRange.from.getTime()) / maxDataPoints,
	);
	const interval = niceIntervalsMs.find(
		(candidate) => candidate >= rawInterval,
	);
	if (!interval)
		throw new RangeError("range cannot fit the requested data point limit");
	return interval;
}

export function bucketStarts(
	resolvedRange: ResolvedRange,
	intervalMs: number,
): Date[] {
	const starts: Date[] = [];
	for (
		let cursor = resolvedRange.from.getTime();
		cursor < resolvedRange.to.getTime();
		cursor += intervalMs
	) {
		starts.push(new Date(cursor));
	}
	return starts;
}
