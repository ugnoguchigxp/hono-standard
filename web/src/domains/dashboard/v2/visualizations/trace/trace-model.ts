import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import type { TraceConfig } from "@shared/schemas/dashboard/specialized-visualizations.schema";
import { SPECIALIZED_LIMITS } from "../specialized/limits";
import {
	fieldFor,
	numberAt,
	rowCount,
	stringAt,
} from "../specialized/frame-values";
import { sanitizeDisplayText } from "../specialized/text";

export type TraceSpan = {
	key: string;
	traceId: string;
	spanId: string;
	parentSpanId?: string;
	operation: string;
	service: string;
	start: number;
	duration: number;
	end: number;
	state?: string;
	depth: number;
	children: string[];
	originalIndex: number;
};

const traceSpanKey = (traceId: string, spanId: string) =>
	`${traceId}\u0000${spanId}`;

const pathKey = (path: TraceSpan[]) => path.map((item) => item.key).join("→");
const pathDuration = (path: TraceSpan[]) =>
	path.reduce((sum, item) => sum + item.duration, 0);

function criticalTracePath(roots: TraceSpan[], byId: Map<string, TraceSpan>) {
	let best: TraceSpan[] = [];
	const visit = (item: TraceSpan, current: TraceSpan[]) => {
		const next = [...current, item];
		const nextDuration = pathDuration(next);
		const bestDuration = pathDuration(best);
		if (
			nextDuration > bestDuration ||
			(nextDuration === bestDuration && pathKey(next) < pathKey(best))
		)
			best = next;
		for (const childKey of item.children) {
			const nextSpan = byId.get(childKey);
			if (nextSpan) visit(nextSpan, next);
		}
	};
	for (const root of roots) visit(root, []);
	return best.map((item) => item.key);
}

function treeOrder(roots: TraceSpan[], byId: Map<string, TraceSpan>) {
	const ordered: TraceSpan[] = [];
	const visit = (item: TraceSpan) => {
		ordered.push(item);
		for (const childKey of item.children) {
			const child = byId.get(childKey);
			if (child) visit(child);
		}
	};
	for (const root of roots) visit(root);
	return ordered;
}

function isErrorState(value: string | undefined) {
	return ["error", "warning", "critical"].includes(value?.toLowerCase() ?? "");
}

export function buildTraceModel(
	frame: DashboardDataFrameV2,
	config: TraceConfig,
	preset = "waterfall",
	durationToMilliseconds = 1,
) {
	if (!Number.isFinite(durationToMilliseconds) || durationToMilliseconds <= 0)
		throw new Error("trace duration multiplier is invalid");
	const traceId = fieldFor(frame, "trace-id");
	const spanId = fieldFor(frame, "span-id");
	const parentId = fieldFor(frame, "parent-span-id");
	const operation = fieldFor(frame, "operation");
	const service = fieldFor(frame, "service");
	const start = fieldFor(frame, "start-time");
	const duration = fieldFor(frame, "duration");
	const end = fieldFor(frame, "end-time");
	const state = fieldFor(frame, "state") ?? fieldFor(frame, "severity");
	if (!traceId || !spanId || !operation || !service || !start || !duration)
		throw new Error(
			"trace requires trace/span/operation/service/start/duration fields",
		);
	if (rowCount(frame) > SPECIALIZED_LIMITS.maxTraceSpans)
		throw new Error("trace span limit exceeded");
	for (const key of config.attributeFields)
		if (!frame.fields.some((field) => field.key === key))
			throw new Error(`trace attribute field is missing: ${key}`);
	const spans: TraceSpan[] = [];
	const byId = new Map<string, TraceSpan>();
	const traceIds = new Set<string>();
	for (let index = 0; index < rowCount(frame); index += 1) {
		const trace = stringAt(traceId, index);
		const span = stringAt(spanId, index);
		const operationName = stringAt(operation, index);
		const serviceName = stringAt(service, index);
		const timestamp = numberAt(start, index);
		const rawLength = numberAt(duration, index);
		const length =
			rawLength === undefined ? undefined : rawLength * durationToMilliseconds;
		if (
			!trace ||
			!span ||
			!operationName ||
			!serviceName ||
			timestamp === undefined ||
			length === undefined ||
			!Number.isFinite(length) ||
			length <= 0
		)
			throw new Error("trace span values are invalid");
		traceIds.add(trace);
		if (traceIds.size > SPECIALIZED_LIMITS.maxTraces)
			throw new Error("trace ID limit exceeded");
		const calculatedEnd = timestamp + length;
		if (!Number.isFinite(calculatedEnd))
			throw new Error("trace span end exceeds numeric range");
		const suppliedEnd = numberAt(end, index);
		if (suppliedEnd !== undefined && Math.abs(suppliedEnd - calculatedEnd) > 1)
			throw new Error("trace end time does not match duration");
		const key = traceSpanKey(trace, span);
		const item: TraceSpan = {
			key,
			traceId: trace,
			spanId: span,
			parentSpanId: parentId
				? stringAt(parentId, index) || undefined
				: undefined,
			operation: sanitizeDisplayText(operationName),
			service: sanitizeDisplayText(serviceName),
			start: timestamp,
			duration: length,
			end: calculatedEnd,
			state: state
				? sanitizeDisplayText(stringAt(state, index)) || undefined
				: undefined,
			depth: 0,
			children: [],
			originalIndex: index,
		};
		if (byId.has(key)) throw new Error("span IDs must be unique within trace");
		byId.set(key, item);
		spans.push(item);
	}
	for (const item of spans) {
		if (!item.parentSpanId) continue;
		const parent = byId.get(traceSpanKey(item.traceId, item.parentSpanId));
		if (!parent) throw new Error("trace parent is missing");
		parent.children.push(item.key);
	}
	const compareSpans = (a: TraceSpan, b: TraceSpan) =>
		a.start - b.start || a.spanId.localeCompare(b.spanId);
	for (const item of spans)
		item.children.sort((left, right) => {
			const leftSpan = byId.get(left);
			const rightSpan = byId.get(right);
			if (!leftSpan || !rightSpan) return left.localeCompare(right);
			return compareSpans(leftSpan, rightSpan);
		});
	const roots = spans.filter((item) => !item.parentSpanId).sort(compareSpans);
	const visiting = new Set<string>();
	const visited = new Set<string>();
	let clockSkewCount = 0;
	const walk = (item: TraceSpan, depth: number) => {
		if (visiting.has(item.key)) throw new Error("trace cycle detected");
		if (depth >= SPECIALIZED_LIMITS.maxTraceDepth)
			throw new Error("trace depth limit exceeded");
		if (visited.has(item.key)) return;
		visiting.add(item.key);
		item.depth = depth;
		for (const childKey of item.children) {
			const child = byId.get(childKey);
			if (!child) continue;
			if (child.start < item.start || child.end > item.end) clockSkewCount += 1;
			walk(child, depth + 1);
		}
		visiting.delete(item.key);
		visited.add(item.key);
	};
	for (const root of roots) walk(root, 0);
	if (visited.size !== spans.length)
		throw new Error("trace contains orphan or cycle");
	const envelope = spans.length
		? {
				from: Math.min(...spans.map((item) => item.start)),
				to: Math.max(...spans.map((item) => item.end)),
			}
		: { from: 0, to: 0 };
	const criticalPath = criticalTracePath(roots, byId);
	let output = treeOrder(roots, byId);
	if (preset === "errors-only") {
		const keep = new Set<string>();
		for (const item of spans) {
			if (!isErrorState(item.state)) continue;
			let current: TraceSpan | undefined = item;
			while (current) {
				keep.add(current.key);
				current = current.parentSpanId
					? byId.get(traceSpanKey(current.traceId, current.parentSpanId))
					: undefined;
			}
		}
		output = output.filter((item) => keep.has(item.key));
	}
	const minimumDuration =
		((envelope.to - envelope.from) * config.minDurationPercent) / 100;
	let durationFilteredCount = 0;
	if (minimumDuration > 0 && output.length > 0) {
		const keep = new Set<string>();
		for (const item of output) {
			if (item.duration < minimumDuration && item.parentSpanId) continue;
			let current: TraceSpan | undefined = item;
			while (current) {
				keep.add(current.key);
				current = current.parentSpanId
					? byId.get(traceSpanKey(current.traceId, current.parentSpanId))
					: undefined;
			}
		}
		const filtered = output.filter((item) => keep.has(item.key));
		durationFilteredCount = output.length - filtered.length;
		output = filtered;
	}
	if (config.order === "duration")
		output = [...output].sort(
			(a, b) =>
				b.duration - a.duration ||
				a.start - b.start ||
				a.key.localeCompare(b.key),
		);
	else if (config.order === "start-time")
		output = [...output].sort(
			(a, b) => a.start - b.start || a.key.localeCompare(b.key),
		);
	const notices: string[] = [];
	if (roots.length > traceIds.size)
		notices.push("partial trace: multiple roots");
	if (clockSkewCount > 0)
		notices.push(`${clockSkewCount} span intervals exceed their parent`);
	if (durationFilteredCount > 0)
		notices.push(
			`${durationFilteredCount} spans below the duration threshold are hidden`,
		);
	if (preset === "errors-only" && output.length === 0)
		notices.push("No error spans in this trace");
	return {
		spans: output,
		allSpans: spans,
		roots,
		envelope,
		criticalPath,
		criticalPathSpanIds: criticalPath.map(
			(key) => byId.get(key)?.spanId ?? key,
		),
		notices,
	};
}
