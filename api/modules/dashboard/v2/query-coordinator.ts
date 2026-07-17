import {
	DASHBOARD_V2_LIMITS,
	type DashboardDataFrameV2,
	type PanelQueryRequestV2,
	type PanelQueryResponseV2,
	panelQueryRequestV2Schema,
	panelQueryResponseV2Schema,
} from "../../../../shared/schemas/dashboard.schema";
import {
	composeAbortSignals,
	getAbortKind,
	raceDashboardOperation,
} from "../abort-signals";
import type { DashboardModule } from "../index";
import { chooseIntervalMs, resolveDashboardRange } from "../interval";
import type { DashboardRuntimeClock } from "../runtime-clock";
import {
	asDashboardRuntimeError,
	DashboardRuntimeError,
} from "../runtime-errors";
import { safeLog } from "../runtime-logger";
import type { DashboardAuthContext } from "../types";
import type { DashboardRegistryV2 } from "./dashboard-registry";
import {
	mergePanelDataStateV2,
	type NormalizedQueryResultV2,
	normalizeQueryHandlerResultV2,
} from "./frame-normalizer";
import { executeServerTransformations } from "./transformation-executor";
import type { DashboardTransformationRegistry } from "./transformation-registry";

export async function queryPanelV2(input: {
	module: DashboardModule;
	registry: DashboardRegistryV2;
	requestId: string;
	requestTime: Date;
	auth: DashboardAuthContext;
	dashboardId: string;
	panelId: string;
	request: PanelQueryRequestV2;
	signal: AbortSignal;
	clock?: DashboardRuntimeClock;
	transformations: DashboardTransformationRegistry;
}): Promise<PanelQueryResponseV2> {
	const clock = input.clock ?? input.module.clock;
	const request = panelQueryRequestV2Schema.parse(input.request);
	const panel = input.registry.getPanel(input.dashboardId, input.panelId);
	if (!panel) {
		if (!input.registry.get(input.dashboardId))
			throw new DashboardRuntimeError(
				"DASHBOARD_NOT_FOUND",
				404,
				"Dashboard not found",
				false,
			);
		throw new DashboardRuntimeError(
			"PANEL_NOT_FOUND",
			404,
			"Panel not found",
			false,
		);
	}
	const filters = input.registry.validatePanelFilters(
		input.dashboardId,
		request.filters,
		{ requireRequired: true },
	);
	const resolvedRange = resolveDashboardRange(
		request.range as never,
		() => input.requestTime,
	);
	const autoInterval = panel.bindings.some(
		(binding) => binding.query.interval !== "none",
	);
	const intervalMs = autoInterval
		? chooseIntervalMs(resolvedRange, request.maxDataPoints)
		: undefined;
	const panelController = new AbortController();
	const panelTimer = setTimeout(
		() => panelController.abort({ kind: "panel-timeout" }),
		input.module.limits.panelTimeoutMs,
	);
	const panelSignals = composeAbortSignals([
		input.signal,
		panelController.signal,
	]);
	const started = clock.monotonicMs();
	try {
		const jobs = panel.bindings.map((binding) =>
			runQuery({
				module: input.module,
				binding,
				request,
				filters,
				resolvedRange,
				intervalMs,
				requestId: input.requestId,
				requestTime: input.requestTime,
				auth: input.auth,
				dashboardId: input.dashboardId,
				panelId: input.panelId,
				signal: panelSignals.signal,
			}),
		);
		const settled = await Promise.allSettled(jobs);
		if (input.signal.aborted)
			throw new DashboardRuntimeError(
				"REQUEST_CANCELLED",
				408,
				"Dashboard request was cancelled",
				false,
			);
		if (panelSignals.signal.aborted && getAbortKind(panelSignals.signal))
			throw abortError(panelSignals.signal);
		let firstError: DashboardRuntimeError | undefined;
		const normalized: NormalizedQueryResultV2[] = [];
		for (const result of settled) {
			if (result.status === "rejected") {
				const error = asDashboardRuntimeError(result.reason);
				if (!firstError) firstError = error;
			} else normalized.push(result.value);
		}
		if (firstError) throw firstError;
		const queryFrames: DashboardDataFrameV2[] = [];
		for (const binding of panel.bindings) {
			const result = normalized.find((item) => item.refId === binding.refId);
			if (!result)
				throw new DashboardRuntimeError(
					"QUERY_FAILED",
					500,
					"Dashboard request failed",
					true,
				);
			queryFrames.push(...result.frames);
		}
		const transformed = await executeServerTransformations({
			panel,
			initialFrames: queryFrames,
			registry: input.transformations,
			requestId: input.requestId,
			requestTime: input.requestTime,
			dashboardId: input.dashboardId,
			panelId: input.panelId,
			signal: panelSignals.signal,
			clock,
			logger: input.module.logger,
			budgetMs: input.module.limits.serverTransformationBudgetMs,
			maxServerTransformations: input.module.limits.maxServerTransformations,
		});
		const state = mergePanelDataStateV2(
			normalized.map((item) => ({ state: item.state, frames: item.frames })),
			transformed.notices,
			transformed.frames,
			transformed.truncated,
		);
		const counts = countFrames(transformed.frames);
		if (counts.frames > DASHBOARD_V2_LIMITS.maxFramesPerResponse)
			throw new DashboardRuntimeError(
				"FRAME_LIMIT_EXCEEDED",
				422,
				"Dashboard frame limit exceeded",
				false,
			);
		if (counts.cells > DASHBOARD_V2_LIMITS.maxCellsPerResponse)
			throw new DashboardRuntimeError(
				"CELL_LIMIT_EXCEEDED",
				422,
				"Dashboard cell limit exceeded",
				false,
			);
		return panelQueryResponseV2Schema.parse({
			schemaVersion: 2,
			requestId: input.requestId,
			generatedAt: input.requestTime.toISOString(),
			resolvedRange: {
				from: resolvedRange.from.toISOString(),
				to: resolvedRange.to.toISOString(),
			},
			...(intervalMs === undefined ? {} : { intervalMs }),
			durationMs: Math.max(0, Math.round(clock.monotonicMs() - started)),
			counts,
			state,
			frames: transformed.frames,
		});
	} finally {
		clearTimeout(panelTimer);
		panelSignals.dispose();
	}
}

async function runQuery(input: {
	module: DashboardModule;
	binding: {
		refId: string;
		queryId: string;
		outputFrameRefs: string[];
		query: {
			id: string;
			filterKeys: string[];
			handler: (context: never) => unknown;
			outputShapes: unknown[];
		};
	};
	request: PanelQueryRequestV2;
	filters: Record<string, string[]>;
	resolvedRange: { from: Date; to: Date };
	intervalMs?: number;
	requestId: string;
	requestTime: Date;
	auth: DashboardAuthContext;
	dashboardId: string;
	panelId: string;
	signal: AbortSignal;
}): Promise<NormalizedQueryResultV2> {
	const queryFilters = Object.fromEntries(
		input.binding.query.filterKeys
			.filter((key) => input.filters[key] !== undefined)
			.map((key) => [key, [...(input.filters[key] ?? [])]]),
	);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let composed: ReturnType<typeof composeAbortSignals> | undefined;
	let release: (() => void) | undefined;
	let actualStarted = false;
	let slotReleased = false;
	const releaseSlot = () => {
		if (slotReleased) return;
		slotReleased = true;
		release?.();
	};
	try {
		release = await input.module.limiter.acquire(input.signal);
		const handlerController = new AbortController();
		timer = setTimeout(
			() => handlerController.abort({ kind: "handler-timeout" }),
			input.module.limits.handlerTimeoutMs,
		);
		const handlerSignals = composeAbortSignals([
			input.signal,
			handlerController.signal,
		]);
		composed = handlerSignals;
		const actual = Promise.resolve().then(() =>
			input.binding.query.handler({
				requestId: input.requestId,
				requestTime: input.requestTime,
				dashboardId: input.dashboardId,
				panelId: input.panelId,
				queryId: input.binding.query.id,
				queryRefId: input.binding.refId,
				outputFrameRefs: [...input.binding.outputFrameRefs],
				range: structuredClone(input.request.range),
				resolvedRange: {
					from: new Date(input.resolvedRange.from),
					to: new Date(input.resolvedRange.to),
				},
				timezone: input.request.timezone,
				filters: queryFilters,
				maxDataPoints: input.request.maxDataPoints,
				maxRows: input.request.maxRows,
				intervalMs: input.intervalMs,
				bucketOriginMs: input.resolvedRange.from.getTime(),
				auth: input.auth,
				signal: handlerSignals.signal,
			} as never),
		);
		actualStarted = true;
		actual.then(releaseSlot, releaseSlot);
		const result = await raceDashboardOperation(actual, {
			signal: handlerSignals.signal,
			onLateSettlement: (outcome) =>
				safeLog(input.module.logger, {
					event: `late-settlement-${outcome}`,
					requestId: input.requestId,
					dashboardId: input.dashboardId,
					panelId: input.panelId,
					queryId: input.binding.query.id,
					queryRefId: input.binding.refId,
				}),
		});
		return normalizeQueryHandlerResultV2({
			binding: input.binding,
			query: input.binding.query as never,
			result,
			maxRows: input.request.maxRows,
		});
	} catch (error) {
		if (error instanceof DashboardRuntimeError) throw error;
		const kind = getAbortKind(composed?.signal ?? input.signal);
		if (kind === "handler-timeout")
			throw new DashboardRuntimeError(
				"HANDLER_TIMEOUT",
				504,
				"Dashboard handler timed out",
				true,
				undefined,
				error,
			);
		if (kind === "panel-timeout")
			throw new DashboardRuntimeError(
				"PANEL_TIMEOUT",
				504,
				"Dashboard panel timed out",
				true,
				undefined,
				error,
			);
		if (kind === "request")
			throw new DashboardRuntimeError(
				"REQUEST_CANCELLED",
				408,
				"Dashboard request was cancelled",
				false,
				undefined,
				error,
			);
		if (
			error &&
			typeof error === "object" &&
			"code" in error &&
			(error as { code?: unknown }).code === "REQUEST_CANCELLED"
		)
			throw new DashboardRuntimeError(
				"REQUEST_CANCELLED",
				408,
				"Dashboard request was cancelled",
				false,
				undefined,
				error,
			);
		if (
			error &&
			typeof error === "object" &&
			"code" in error &&
			(error as { code?: unknown }).code === "EXECUTION_LIMIT_REACHED"
		)
			throw new DashboardRuntimeError(
				"EXECUTION_LIMIT_REACHED",
				429,
				"Dashboard execution limit reached",
				true,
				undefined,
				error,
			);
		throw new DashboardRuntimeError(
			"QUERY_FAILED",
			500,
			"Dashboard request failed",
			true,
			undefined,
			error,
		);
	} finally {
		if (!actualStarted) releaseSlot();
		if (timer !== undefined) clearTimeout(timer);
		composed?.dispose();
	}
}

function countFrames(frames: DashboardDataFrameV2[]) {
	return frames.reduce(
		(count, frame) => {
			const rows = frame.fields[0]?.values.length ?? 0;
			count.frames += 1;
			count.fields += frame.fields.length;
			count.rows += rows;
			count.cells += rows * frame.fields.length;
			return count;
		},
		{ frames: 0, fields: 0, rows: 0, cells: 0 },
	);
}

function abortError(signal: AbortSignal) {
	const kind = getAbortKind(signal);
	if (kind === "panel-timeout")
		return new DashboardRuntimeError(
			"PANEL_TIMEOUT",
			504,
			"Dashboard panel timed out",
			true,
		);
	if (kind === "handler-timeout")
		return new DashboardRuntimeError(
			"HANDLER_TIMEOUT",
			504,
			"Dashboard handler timed out",
			true,
		);
	return new DashboardRuntimeError(
		"REQUEST_CANCELLED",
		408,
		"Dashboard request was cancelled",
		false,
	);
}
