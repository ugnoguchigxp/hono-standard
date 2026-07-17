import {
	DASHBOARD_V2_LIMITS,
	type DashboardDataFrameV2,
} from "@shared/schemas/dashboard.schema";
import { buildStateIntervals, type StateInterval } from "./interval-model";
import { buildStateSamples, type StateSample } from "./sample-model";
import type { StateSemantic } from "./state-value";

export type UptimeBucket = {
	laneId: string;
	laneLabel: string;
	start: number;
	end: number;
	observedMs: number;
	healthyMs: number;
	warningMs: number;
	criticalMs: number;
	unknownMs: number;
	missingMs: number;
	uptimeRatio: number | null;
	dominantState: StateSemantic;
	incidentCount?: number;
};
export type UptimeModel = { buckets: UptimeBucket[]; notices: string[] };

type Parts = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
};
const partFormatter = (timezone: string, hour12 = false) =>
	new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12,
	});
function partsAt(timestamp: number, timezone: string): Parts {
	const entries = partFormatter(timezone).formatToParts(new Date(timestamp));
	const get = (type: string) =>
		Number(entries.find((item) => item.type === type)?.value ?? 0);
	return {
		year: get("year"),
		month: get("month"),
		day: get("day"),
		hour: get("hour") % 24,
		minute: get("minute"),
		second: get("second"),
	};
}
function offsetAt(timestamp: number, timezone: string) {
	const p = partsAt(timestamp, timezone);
	return (
		Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - timestamp
	);
}
function localToUtc(p: Parts, timezone: string) {
	const guess = Date.UTC(
		p.year,
		p.month - 1,
		p.day,
		p.hour,
		p.minute,
		p.second,
	);
	let value = guess;
	for (let iteration = 0; iteration < 3; iteration += 1)
		value = guess - offsetAt(value, timezone);
	return value;
}
function addLocalHours(p: Parts, amount: number): Parts {
	const date = new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour + amount));
	return {
		year: date.getUTCFullYear(),
		month: date.getUTCMonth() + 1,
		day: date.getUTCDate(),
		hour: date.getUTCHours(),
		minute: 0,
		second: 0,
	};
}
function floorLocal(
	timestamp: number,
	bucket: "hour" | "day",
	timezone: string,
): Parts {
	const p = partsAt(timestamp, timezone);
	return {
		year: p.year,
		month: p.month,
		day: p.day,
		hour: bucket === "hour" ? p.hour : 0,
		minute: 0,
		second: 0,
	};
}
export function buildBucketBoundaries(
	range: { from: number; to: number },
	bucket: "hour" | "day",
	timezone: string,
) {
	if (
		!Number.isSafeInteger(range.from) ||
		!Number.isSafeInteger(range.to) ||
		range.from >= range.to
	)
		throw new Error("UPTIME_RANGE_INVALID");
	const boundaries: number[] = [];
	let local = floorLocal(range.from, bucket, timezone);
	let current = localToUtc(local, timezone);
	if (bucket === "hour") {
		while (current > range.from) current -= 60 * 60 * 1_000;
		while (current + 60 * 60 * 1_000 <= range.from) current += 60 * 60 * 1_000;
		while (current < range.to) {
			if (current >= range.from) boundaries.push(current);
			current += 60 * 60 * 1_000;
			if (boundaries.length > DASHBOARD_V2_LIMITS.maxUptimeBuckets)
				throw new Error("UPTIME_BUCKET_LIMIT");
		}
	} else {
		if (current > range.from) {
			local = addLocalHours(local, -24);
			current = localToUtc(local, timezone);
		}
		while (current < range.to) {
			if (current >= range.from) boundaries.push(current);
			local = addLocalHours(local, 24);
			const next = localToUtc(local, timezone);
			if (next <= current) throw new Error("UPTIME_BUCKET_ORDER_INVALID");
			current = next;
			if (boundaries.length > DASHBOARD_V2_LIMITS.maxUptimeBuckets)
				throw new Error("UPTIME_BUCKET_LIMIT");
		}
	}
	if (boundaries[0] !== range.from) boundaries.unshift(range.from);
	if (boundaries.at(-1) !== range.to) boundaries.push(range.to);
	const result = [...new Set(boundaries)]
		.filter((value) => value >= range.from && value <= range.to)
		.sort((a, b) => a - b);
	if (result.length - 1 > DASHBOARD_V2_LIMITS.maxUptimeBuckets)
		throw new Error("UPTIME_BUCKET_LIMIT");
	return result;
}

function emptyBucket(
	laneId: string,
	laneLabel: string,
	start: number,
	end: number,
): UptimeBucket {
	return {
		laneId,
		laneLabel,
		start,
		end,
		observedMs: 0,
		healthyMs: 0,
		warningMs: 0,
		criticalMs: 0,
		unknownMs: 0,
		missingMs: end - start,
		uptimeRatio: null,
		dominantState: "unknown",
	};
}
function addDuration(
	bucket: UptimeBucket,
	semantic: StateSemantic,
	duration: number,
) {
	bucket.observedMs += duration;
	bucket.missingMs = Math.max(0, bucket.missingMs - duration);
	if (semantic === "healthy") bucket.healthyMs += duration;
	else if (semantic === "warning") bucket.warningMs += duration;
	else if (semantic === "critical") bucket.criticalMs += duration;
	else bucket.unknownMs += duration;
}
function finalize(bucket: UptimeBucket, minimumCoveragePercent: number) {
	const totals: Array<[StateSemantic, number]> = [
		["healthy", bucket.healthyMs],
		["warning", bucket.warningMs],
		["critical", bucket.criticalMs],
		["unknown", bucket.unknownMs],
	];
	bucket.dominantState =
		totals.sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
	const coverage = (bucket.observedMs / (bucket.end - bucket.start)) * 100;
	bucket.uptimeRatio =
		coverage >= minimumCoveragePercent && bucket.observedMs > 0
			? bucket.healthyMs / bucket.observedMs
			: null;
}
function intervalsFromSamples(
	samples: StateSample[],
	range: { from: number; to: number },
	cadence?: number,
): StateInterval[] {
	const result: StateInterval[] = [];
	for (const laneId of new Set(samples.map((sample) => sample.laneId))) {
		const lane = samples.filter(
			(sample) => sample.laneId === laneId && !sample.missing,
		);
		for (let index = 0; index < lane.length; index += 1) {
			const sample = lane[index];
			const nextSample = lane[index + 1]?.time ?? range.to;
			const next = cadence
				? Math.min(nextSample, sample.time + cadence)
				: nextSample;
			const start = Math.max(range.from, sample.time);
			const end = Math.min(range.to, next);
			if (start < end)
				result.push({
					id: sample.id,
					laneId,
					laneLabel: sample.laneLabel,
					start,
					end,
					state: sample.state,
					durationMs: end - start,
					openEnded: !lane[index + 1],
				});
		}
	}
	return result;
}

export function buildUptimeModel(input: {
	frame?: DashboardDataFrameV2;
	intervals?: StateInterval[];
	range: { from: number; to: number };
	timezone: string;
	bucket: "hour" | "day";
	minimumCoveragePercent?: number;
	expectedCadenceMs?: number;
	incidentTimes?: number[];
}): UptimeModel {
	if (
		!Number.isSafeInteger(input.range.from) ||
		!Number.isSafeInteger(input.range.to) ||
		input.range.from >= input.range.to
	)
		throw new Error("UPTIME_RANGE_INVALID");
	const minimumCoveragePercent = input.minimumCoveragePercent ?? 80;
	if (minimumCoveragePercent < 0 || minimumCoveragePercent > 100)
		throw new Error("UPTIME_COVERAGE_INVALID");
	let intervals = input.intervals ?? [];
	if (input.frame) {
		if (input.frame.meta.shapeHint === "state-sample")
			intervals = intervalsFromSamples(
				buildStateSamples(input.frame, {
					expectedCadenceMs: input.expectedCadenceMs,
				}).samples,
				input.range,
				input.expectedCadenceMs,
			);
		else
			intervals = buildStateIntervals(input.frame, {
				range: input.range,
				expectedCadenceMs: input.expectedCadenceMs,
			}).intervals;
	}
	const laneLast = new Map<string, StateInterval>();
	for (const interval of intervals) {
		if (
			!Number.isSafeInteger(interval.start) ||
			!Number.isSafeInteger(interval.end) ||
			interval.start >= interval.end
		)
			throw new Error("UPTIME_INTERVAL_INVALID");
		const prior = laneLast.get(interval.laneId);
		if (prior && interval.start < prior.start)
			throw new Error("UPTIME_INTERVAL_UNSORTED");
		if (prior && interval.start < prior.end)
			throw new Error("UPTIME_INTERVAL_OVERLAP");
		laneLast.set(interval.laneId, interval);
	}
	const boundaries = buildBucketBoundaries(
		input.range,
		input.bucket,
		input.timezone,
	);
	const lanes = [
		...new Map(
			intervals.map((item) => [item.laneId, item.laneLabel]),
		).entries(),
	];
	if (lanes.length > DASHBOARD_V2_LIMITS.maxStateLanes)
		throw new Error("STATE_LANE_LIMIT");
	const bucketCount = Math.max(0, boundaries.length - 1);
	if (bucketCount > DASHBOARD_V2_LIMITS.maxUptimeBuckets)
		throw new Error("UPTIME_BUCKET_LIMIT");
	if (lanes.length * bucketCount > DASHBOARD_V2_LIMITS.maxUptimeCells)
		throw new Error("UPTIME_CELL_LIMIT");
	const buckets = lanes.flatMap(([laneId, laneLabel]) =>
		boundaries
			.slice(0, -1)
			.map((start, index) =>
				emptyBucket(laneId, laneLabel, start, boundaries[index + 1] ?? start),
			),
	);
	for (const bucket of buckets)
		for (const interval of intervals) {
			if (interval.laneId !== bucket.laneId) continue;
			const start = Math.max(bucket.start, interval.start);
			const end = Math.min(bucket.end, interval.end);
			if (start < end)
				addDuration(bucket, interval.state.semantic, end - start);
		}
	for (const bucket of buckets) {
		if (input.incidentTimes)
			bucket.incidentCount = input.incidentTimes.filter(
				(time) => time >= bucket.start && time < bucket.end,
			).length;
		finalize(bucket, minimumCoveragePercent);
	}
	return {
		buckets,
		notices: [],
	};
}

export const aggregateUptime = buildUptimeModel;
