import {
	DASHBOARD_V2_LIMITS,
	type DashboardDataFrameV2,
	dashboardDataFrameV2Schema,
	dashboardDataShapeSchema,
	type PanelDataStateV2,
	panelDataStateV2Schema,
	validateDashboardDataFrameShape,
} from "../../../../shared/schemas/dashboard.schema";
import { DashboardRuntimeError } from "../runtime-errors";
import type {
	DashboardQueryDefinitionV2,
	DashboardQueryFrameInputV2,
} from "./types";

export type NormalizedQueryResultV2 = {
	frames: DashboardDataFrameV2[];
	state: PanelDataStateV2;
	refId: string;
};

export function normalizeQueryHandlerResultV2(options: {
	binding: { refId: string; outputFrameRefs: string[] };
	query: DashboardQueryDefinitionV2;
	result: unknown;
	state?: unknown;
	maxRows?: number;
}): NormalizedQueryResultV2 {
	if (
		!options.result ||
		typeof options.result !== "object" ||
		Array.isArray(options.result)
	)
		throw new DashboardRuntimeError(
			"INVALID_HANDLER_RESULT",
			422,
			"Dashboard handler returned an invalid result",
			false,
		);
	const envelope = options.result as { frames?: unknown; state?: unknown };
	if (!Array.isArray(envelope.frames))
		throw new DashboardRuntimeError(
			"INVALID_HANDLER_RESULT",
			422,
			"Dashboard handler returned an invalid result",
			false,
		);
	if (
		envelope.frames.length > 4 ||
		envelope.frames.some(
			(frame) =>
				!frame ||
				typeof frame !== "object" ||
				Array.isArray(frame) ||
				"schemaVersion" in frame ||
				"source" in frame,
		)
	)
		throw new DashboardRuntimeError(
			"INVALID_HANDLER_RESULT",
			422,
			"Dashboard handler returned an invalid result",
			false,
		);
	const parsedFrames = envelope.frames.map((raw) => {
		if (!raw || typeof raw !== "object" || Array.isArray(raw))
			throw new DashboardRuntimeError(
				"INVALID_HANDLER_RESULT",
				422,
				"Dashboard handler returned an invalid result",
				false,
			);
		const value = raw as Record<string, unknown>;
		const parsed = dashboardDataFrameV2Schema.safeParse({
			...value,
			schemaVersion: 2,
			source: { kind: "query", refId: value.refId },
		});
		if (!parsed.success)
			throw new DashboardRuntimeError(
				"INVALID_HANDLER_RESULT",
				422,
				"Dashboard handler returned an invalid result",
				false,
				undefined,
				parsed.error,
			);
		const {
			schemaVersion: _schemaVersion,
			source: _source,
			...frame
		} = parsed.data;
		return frame;
	});
	const refs = parsedFrames.map((frame) => frame.refId);
	if (
		new Set(refs).size !== refs.length ||
		refs.length !== options.binding.outputFrameRefs.length ||
		refs.some((ref) => !options.binding.outputFrameRefs.includes(ref))
	)
		throw new DashboardRuntimeError(
			"INVALID_HANDLER_RESULT",
			422,
			"Dashboard handler returned undeclared frames",
			false,
		);
	const state = panelDataStateV2Schema.safeParse(
		envelope.state ?? options.state ?? {},
	);
	if (!state.success)
		throw new DashboardRuntimeError(
			"INVALID_HANDLER_RESULT",
			422,
			"Dashboard handler returned an invalid state",
			false,
			undefined,
			state.error,
		);
	const frames = options.binding.outputFrameRefs.map((ref, index) => {
		const input = parsedFrames.find(
			(frame) => frame.refId === ref,
		) as DashboardQueryFrameInputV2;
		if (!input)
			throw new DashboardRuntimeError(
				"INVALID_HANDLER_RESULT",
				422,
				"Dashboard handler omitted a declared frame",
				false,
			);
		if (
			!input.meta.shapeHint ||
			!dashboardDataShapeSchema.safeParse(input.meta.shapeHint).success
		)
			throw new DashboardRuntimeError(
				"INVALID_DATA_FRAME",
				422,
				"Dashboard frame shape is required",
				false,
			);
		if (input.meta.shapeHint !== options.query.outputShapes[index])
			throw new DashboardRuntimeError(
				"INVALID_DATA_FRAME",
				422,
				"Dashboard frame shape does not match its declaration",
				false,
			);
		const frame = dashboardDataFrameV2Schema.safeParse({
			...input,
			schemaVersion: 2,
			source: { kind: "query", refId: options.binding.refId },
		});
		if (!frame.success)
			throw new DashboardRuntimeError(
				"INVALID_DATA_FRAME",
				422,
				"Dashboard data frame is invalid",
				false,
				undefined,
				frame.error,
			);
		const shape = validateDashboardDataFrameShape(frame.data);
		if (!shape.valid)
			throw new DashboardRuntimeError(
				"INVALID_DATA_FRAME",
				422,
				"Dashboard data frame shape is invalid",
				false,
			);
		const rows = frame.data.fields[0]?.values.length ?? 0;
		if (rows > (options.maxRows ?? DASHBOARD_V2_LIMITS.maxRowsPerFrame))
			throw new DashboardRuntimeError(
				"FRAME_LIMIT_EXCEEDED",
				422,
				"Dashboard frame row limit exceeded",
				false,
			);
		return frame.data;
	});
	const cells = frames.reduce(
		(sum, frame) =>
			sum + frame.fields.length * (frame.fields[0]?.values.length ?? 0),
		0,
	);
	if (cells > DASHBOARD_V2_LIMITS.maxCellsPerResponse)
		throw new DashboardRuntimeError(
			"CELL_LIMIT_EXCEEDED",
			422,
			"Dashboard response cell limit exceeded",
			false,
		);
	return { frames, state: state.data, refId: options.binding.refId };
}

export function mergePanelDataStateV2(
	results: Array<{ state: PanelDataStateV2; frames: DashboardDataFrameV2[] }>,
	transformationNotices: PanelDataStateV2["notices"] = [],
	responseFrames: DashboardDataFrameV2[] = results.flatMap(
		(result) => result.frames,
	),
	transformationTruncated = false,
): PanelDataStateV2 {
	const states = results.map((result) => result.state);
	const notices = [
		...states.flatMap((state) => state.notices),
		...transformationNotices,
	];
	if (notices.length > DASHBOARD_V2_LIMITS.maxNotices)
		throw new DashboardRuntimeError(
			"INVALID_HANDLER_RESULT",
			422,
			"Dashboard notices exceed the limit",
			false,
		);
	const hasRows = responseFrames.some(
		(frame) => (frame.fields[0]?.values.length ?? 0) > 0,
	);
	const result: PanelDataStateV2 = {
		partial: states.some((state) => state.partial),
		truncated:
			transformationTruncated || states.some((state) => state.truncated),
		notices,
		...(hasRows ? {} : { emptyReason: priorityEmptyReason(states) }),
	};
	if (
		result.truncated &&
		!result.notices.some((notice) => notice.code === "DATA_TRUNCATED")
	)
		appendPanelNotice(result.notices, {
			severity: "warning",
			code: "DATA_TRUNCATED",
			message: "Data was truncated",
		});
	const nonempty = results.filter((result) =>
		result.frames.some((frame) => (frame.fields[0]?.values.length ?? 0) > 0),
	);
	const freshness = nonempty.map((result) => result.state);
	const hasAnyFreshness = freshness.some(
		(state) => state.dataThrough || state.staleAfterMs !== undefined,
	);
	if (freshness.length > 0 && hasAnyFreshness) {
		if (
			freshness.every(
				(state) => state.dataThrough && state.staleAfterMs !== undefined,
			)
		) {
			const through = Math.min(
				...freshness.map((state) => Date.parse(state.dataThrough as string)),
			);
			const staleAt = Math.min(
				...freshness.map(
					(state) =>
						Date.parse(state.dataThrough as string) +
						(state.staleAfterMs as number),
				),
			);
			result.dataThrough = new Date(through).toISOString();
			result.staleAfterMs = Math.max(1, staleAt - through);
		} else
			appendPanelNotice(result.notices, {
				severity: "info",
				code: "FRESHNESS_METADATA_INCOMPLETE",
				message: "Freshness metadata was incomplete",
			});
	}
	return panelDataStateV2Schema.parse(result);
}

function appendPanelNotice(
	notices: PanelDataStateV2["notices"],
	notice: PanelDataStateV2["notices"][number],
) {
	if (notices.length >= DASHBOARD_V2_LIMITS.maxNotices)
		throw new DashboardRuntimeError(
			"INVALID_HANDLER_RESULT",
			422,
			"Dashboard notices exceed the limit",
			false,
		);
	notices.push(notice);
}

function priorityEmptyReason(
	states: PanelDataStateV2[],
): PanelDataStateV2["emptyReason"] {
	for (const reason of [
		"not-configured",
		"filter-no-match",
		"no-records",
	] as const)
		if (states.some((state) => state.emptyReason === reason)) return reason;
	return "no-records";
}
