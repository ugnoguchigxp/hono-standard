import {
	DASHBOARD_V2_LIMITS,
	type DashboardDataFrameV2,
} from "@shared/schemas/dashboard.schema";
import { resolveStateField, type StateDatum } from "./state-value";

export type StateSample = {
	id: string;
	laneId: string;
	laneLabel: string;
	time: number;
	state: StateDatum;
	missing: boolean;
	synthetic?: boolean;
};
export type SampleModel = {
	samples: StateSample[];
	columns: number[];
	notices: string[];
};

export function buildStateSamples(
	frame: DashboardDataFrameV2,
	options: {
		laneFieldKey?: string;
		expectedCadenceMs?: number;
		cadenceTolerancePercent?: number;
		range?: { from: number; to: number };
	} = {},
): SampleModel {
	const time = frame.fields.find((field) => field.roles.includes("time"));
	const state = frame.fields.find((field) => field.roles.includes("state"));
	const lane = options.laneFieldKey
		? frame.fields.find((field) => field.key === options.laneFieldKey)
		: frame.fields.find(
				(field) =>
					field.roles.includes("category") || field.roles.includes("series"),
			);
	if (!time || !state) throw new Error("STATE_SAMPLE_FIELDS_MISSING");
	if (time.values.length > DASHBOARD_V2_LIMITS.maxStateSamples)
		throw new Error("STATE_SAMPLE_LIMIT");
	if (
		options.range &&
		(!Number.isSafeInteger(options.range.from) ||
			!Number.isSafeInteger(options.range.to) ||
			options.range.from >= options.range.to)
	)
		throw new Error("STATE_RANGE_INVALID");
	const samples: StateSample[] = [];
	const seen = new Set<string>();
	const laneLast = new Map<string, number>();
	const laneIds = new Set<string>();
	for (let row = 0; row < time.values.length; row += 1) {
		const value = time.values[row];
		if (value === null || !Number.isSafeInteger(value))
			throw new Error("STATE_SAMPLE_TIME_INVALID");
		const timestamp = value as number;
		const laneId = String(lane?.values[row] ?? "default");
		laneIds.add(laneId);
		const key = `${laneId}:${timestamp}`;
		if (seen.has(key)) throw new Error("STATE_SAMPLE_DUPLICATE");
		seen.add(key);
		const priorTime = laneLast.get(laneId);
		if (priorTime !== undefined && timestamp <= priorTime)
			throw new Error("STATE_SAMPLE_UNSORTED");
		laneLast.set(laneId, timestamp);
		if (
			!options.range ||
			(timestamp >= options.range.from && timestamp <= options.range.to)
		)
			samples.push({
				id: key,
				laneId,
				laneLabel: laneId,
				time: timestamp,
				state: resolveStateField(state, row),
				missing: false,
			});
	}
	if (laneIds.size > DASHBOARD_V2_LIMITS.maxStateLanes)
		throw new Error("STATE_LANE_LIMIT");
	const cadence = options.expectedCadenceMs;
	const tolerance = (options.cadenceTolerancePercent ?? 10) / 100;
	if (cadence !== undefined && (!Number.isSafeInteger(cadence) || cadence <= 0))
		throw new Error("STATE_CADENCE_INVALID");
	if (tolerance < 0 || tolerance > 0.5)
		throw new Error("STATE_CADENCE_TOLERANCE_INVALID");
	const columns = [...new Set(samples.map((sample) => sample.time))].sort(
		(a, b) => a - b,
	);
	if (cadence) {
		for (const laneId of new Set(samples.map((item) => item.laneId))) {
			const laneSamples = samples.filter((item) => item.laneId === laneId);
			for (let index = 1; index < laneSamples.length; index += 1) {
				const prior = laneSamples[index - 1];
				const current = laneSamples[index];
				if (current.time - prior.time > cadence * (1 + tolerance)) {
					for (let step = 1; ; step += 1) {
						const timeValue = prior.time + step * cadence;
						if (timeValue + cadence * tolerance >= current.time) break;
						if (
							options.range &&
							(timeValue < options.range.from || timeValue > options.range.to)
						)
							continue;
						const synthetic: StateSample = {
							id: `${laneId}:${timeValue}`,
							laneId,
							laneLabel: laneId,
							time: timeValue,
							state: {
								raw: null,
								text: "Missing",
								semantic: "unknown",
								colorToken: "--color-chart-muted",
							},
							missing: true,
							synthetic: true,
						};
						if (!seen.has(synthetic.id)) {
							samples.push(synthetic);
							columns.push(timeValue);
							seen.add(synthetic.id);
						}
					}
				}
			}
		}
	}
	const uniqueColumns = [...new Set(columns)].sort((a, b) => a - b);
	if (samples.length > DASHBOARD_V2_LIMITS.maxStateSamples)
		throw new Error("STATE_SAMPLE_LIMIT");
	if (uniqueColumns.length > DASHBOARD_V2_LIMITS.maxStateColumns)
		throw new Error("STATE_COLUMN_LIMIT");
	if (laneIds.size * uniqueColumns.length > DASHBOARD_V2_LIMITS.maxStateCells)
		throw new Error("STATE_CELL_LIMIT");
	return {
		samples: samples.sort(
			(a, b) => a.time - b.time || a.laneId.localeCompare(b.laneId),
		),
		columns: uniqueColumns,
		notices: [],
	};
}

export const buildSampleModel = buildStateSamples;
