import {
	DASHBOARD_V2_LIMITS,
	type DashboardDataFrameV2,
} from "@shared/schemas/dashboard.schema";
import {
	resolveStateField,
	stateRawIdentity,
	type StateDatum,
} from "./state-value";

export type StateInterval = {
	id: string;
	laneId: string;
	laneLabel: string;
	start: number;
	end: number;
	state: StateDatum;
	durationMs: number;
	openEnded: boolean;
	missing?: boolean;
};
export type MissingInterval = {
	laneId: string;
	laneLabel: string;
	start: number;
	end: number;
	missing: true;
};
export type IntervalModel = {
	intervals: StateInterval[];
	gaps: MissingInterval[];
	notices: string[];
};

const roleField = (frame: DashboardDataFrameV2, role: string, key?: string) =>
	frame.fields.find((field) =>
		key ? field.key === key : field.roles.includes(role as never),
	);
const safeEpoch = (value: unknown): number => {
	if (typeof value !== "number" || !Number.isSafeInteger(value))
		throw new Error("STATE_TIME_INVALID");
	return value;
};

export function buildStateIntervals(
	frame: DashboardDataFrameV2,
	options: {
		range: { from: number; to: number };
		laneFieldKey?: string;
		stateFieldKey?: string;
		expectedCadenceMs?: number;
		mergeAdjacent?: boolean;
		mergeBy?: "raw" | "semantic";
	} = { range: { from: Number.MIN_SAFE_INTEGER, to: Number.MAX_SAFE_INTEGER } },
): IntervalModel {
	if (
		!Number.isSafeInteger(options.range.from) ||
		!Number.isSafeInteger(options.range.to) ||
		options.range.from >= options.range.to
	)
		throw new Error("STATE_RANGE_INVALID");
	const startField = roleField(frame, "start-time");
	const endField = roleField(frame, "end-time");
	const timeField = startField ?? roleField(frame, "time");
	const stateField = roleField(frame, "state", options.stateFieldKey);
	const laneField =
		roleField(frame, "category", options.laneFieldKey) ??
		roleField(frame, "series");
	if (!timeField || !stateField)
		throw new Error("STATE_INTERVAL_FIELDS_MISSING");
	const rows = timeField.values.length;
	if (rows > DASHBOARD_V2_LIMITS.maxStateIntervals)
		throw new Error("STATE_INTERVAL_LIMIT");
	const result: StateInterval[] = [];
	const laneRows = new Map<
		string,
		Array<{ row: number; start: number; laneLabel: string }>
	>();
	const laneLabels = new Map<string, string>();
	for (let row = 0; row < rows; row += 1) {
		const start = safeEpoch(timeField.values[row]);
		const rawLane = laneField?.values[row] ?? "default";
		const laneId = String(rawLane);
		const laneLabel = String(rawLane);
		const entries = laneRows.get(laneId) ?? [];
		const last = entries.at(-1);
		if (last && start <= last.start) throw new Error("STATE_INTERVAL_UNSORTED");
		entries.push({ row, start, laneLabel });
		laneRows.set(laneId, entries);
		laneLabels.set(laneId, laneLabel);
	}
	if (laneRows.size > DASHBOARD_V2_LIMITS.maxStateLanes)
		throw new Error("STATE_LANE_LIMIT");
	for (const entries of laneRows.values())
		if (entries.length > 500) throw new Error("STATE_LANE_INTERVAL_LIMIT");

	const notices: string[] = [];
	for (const [laneId, entries] of laneRows) {
		let priorRawEnd: number | undefined;
		for (let index = 0; index < entries.length; index += 1) {
			const entry = entries[index];
			if (!entry) continue;
			const endValue = endField?.values[entry.row];
			const inferredEnd = entries[index + 1]?.start ?? options.range.to;
			const openEnded = endValue === null || endValue === undefined;
			const end = openEnded ? inferredEnd : safeEpoch(endValue);
			if (entry.start >= end) throw new Error("STATE_INTERVAL_ORDER_INVALID");
			if (priorRawEnd !== undefined && priorRawEnd > entry.start)
				throw new Error("STATE_INTERVAL_OVERLAP");
			priorRawEnd = end;
			const clippedStart = Math.max(entry.start, options.range.from);
			const clippedEnd = Math.min(end, options.range.to);
			if (clippedStart >= clippedEnd) {
				notices.push(`STATE_INTERVAL_CLIPPED_EMPTY:${laneId}:${entry.row}`);
				continue;
			}
			const state = resolveStateField(stateField, entry.row);
			result.push({
				id: `${laneId}:${entry.start}:${entry.row}`,
				laneId,
				laneLabel: entry.laneLabel,
				start: clippedStart,
				end: clippedEnd,
				state,
				durationMs: clippedEnd - clippedStart,
				openEnded,
			});
		}
	}
	result.sort((a, b) => a.start - b.start || a.laneId.localeCompare(b.laneId));
	const gaps: MissingInterval[] = [];
	const gapThreshold = options.expectedCadenceMs ?? 0;
	for (const laneId of laneLabels.keys()) {
		const lane = result.filter((item) => item.laneId === laneId);
		for (let index = 1; index < lane.length; index += 1) {
			const prior = lane[index - 1];
			const current = lane[index];
			if (!prior || !current) continue;
			if (current.start - prior.end > gapThreshold)
				gaps.push({
					laneId,
					laneLabel: current.laneLabel,
					start: prior.end,
					end: current.start,
					missing: true,
				});
		}
	}
	if (options.mergeAdjacent) {
		const merged: StateInterval[] = [];
		const laneLast = new Map<string, StateInterval>();
		for (const item of result) {
			const prior = laneLast.get(item.laneId);
			const same =
				prior &&
				prior.end === item.start &&
				(options.mergeBy === "semantic"
					? prior.state.semantic === item.state.semantic
					: stateRawIdentity(prior.state.raw) ===
						stateRawIdentity(item.state.raw));
			if (same && prior) {
				prior.end = item.end;
				prior.durationMs = prior.end - prior.start;
				prior.openEnded = item.openEnded;
			} else {
				const copy = { ...item };
				merged.push(copy);
				laneLast.set(item.laneId, copy);
			}
		}
		return { intervals: merged, gaps, notices };
	}
	return { intervals: result, gaps, notices };
}

export function buildThresholdIntervals(
	frame: DashboardDataFrameV2,
	options: Parameters<typeof buildStateIntervals>[1],
) {
	const time = roleField(frame, "time");
	const numeric = roleField(frame, "state") ?? roleField(frame, "value");
	if (!time || !numeric) throw new Error("STATE_SAMPLE_FIELDS_MISSING");
	const lane = roleField(frame, "category") ?? roleField(frame, "series");
	const derived: DashboardDataFrameV2 = {
		...frame,
		meta: { ...frame.meta, shapeHint: "state-sample" as const },
		fields: [
			time,
			{ ...numeric, roles: ["state" as const] },
			...(lane ? [lane] : []),
		],
	};
	return buildStateIntervals(derived, options);
}

export const buildIntervalModel = buildStateIntervals;
