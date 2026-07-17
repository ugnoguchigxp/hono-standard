import {
	type PanelQueryResponse,
	panelQueryRequestSchema,
	panelQueryResponseSchema,
} from "../../../shared/schemas/dashboard.schema";
import {
	composeAbortSignals,
	raceDashboardOperation,
	throwIfAborted,
	timeoutSignal,
} from "./abort-signals";
import { DashboardExecutionLimitError } from "./execution-limiter";
import type { DashboardModule } from "./index";
import { chooseIntervalMs, resolveDashboardRange } from "./interval";
import {
	DashboardNormalizationError,
	normalizePanelResult,
} from "./normalize-result";
import { safeLog } from "./runtime-logger";
import type { DashboardAuthContext } from "./types";

export class DashboardQueryError extends Error {
	constructor(
		readonly code: string,
		message: string,
		readonly retryable = false,
	) {
		super(message);
		this.name = "DashboardQueryError";
	}
}

export type DashboardQueryExecutor = {
	query: (
		dashboardId: string,
		panelId: string,
		request: unknown,
		signal: AbortSignal,
	) => Promise<PanelQueryResponse>;
	queryWithContext: (
		dashboardId: string,
		panelId: string,
		request: unknown,
		context: DashboardLegacyOperationContext,
	) => Promise<PanelQueryResponse>;
};

export type DashboardLegacyOperationContext = {
	requestId: string;
	requestTime: Date;
	auth: DashboardAuthContext;
	signal: AbortSignal;
};

export function createDashboardQueryExecutor(
	module: DashboardModule,
): DashboardQueryExecutor {
	const limiter = module.limiter;
	return {
		async query(dashboardId, panelId, request, requestSignal) {
			return this.queryWithContext(dashboardId, panelId, request, {
				requestId: module.requestIdFactory(),
				requestTime: module.now(),
				auth: { userId: "legacy", email: "legacy@invalid", role: "member" },
				signal: requestSignal,
			});
		},
		async queryWithContext(dashboardId, panelId, request, operation) {
			const parsed = panelQueryRequestSchema.safeParse(request);
			if (!parsed.success)
				throw new DashboardQueryError(
					"INVALID_REQUEST",
					"Invalid panel query request",
				);
			const panel = module.registry.getPanel(dashboardId, panelId);
			if (!module.registry.get(dashboardId))
				throw new DashboardQueryError(
					"DASHBOARD_NOT_FOUND",
					"Dashboard not found",
				);
			if (!panel)
				throw new DashboardQueryError("PANEL_NOT_FOUND", "Panel not found");
			const resolvedRange = resolveDashboardRange(
				parsed.data.range,
				() => operation.requestTime,
			);
			const intervalMs = chooseIntervalMs(
				resolvedRange,
				parsed.data.maxDataPoints,
			);
			const requestId = operation.requestId;
			const startedAt = module.clock.monotonicMs();
			let timeout: ReturnType<typeof timeoutSignal> | undefined;
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
				release = await limiter.acquire(operation.signal);
				timeout = timeoutSignal(module.limits.handlerTimeoutMs);
				const handlerSignals = composeAbortSignals([
					operation.signal,
					timeout.signal,
				]);
				composed = handlerSignals;
				throwIfAborted(handlerSignals.signal);
				const actual = Promise.resolve().then(() =>
					panel.handler({
						...parsed.data,
						range: parsed.data.range,
						resolvedRange,
						dashboardId,
						panelId,
						queryId: panel.manifest.queryId,
						intervalMs,
						signal: handlerSignals.signal,
						now: () => operation.requestTime,
						requestId,
						requestTime: operation.requestTime,
						auth: operation.auth,
					}),
				);
				actualStarted = true;
				actual.then(releaseSlot, releaseSlot);
				const handlerResult = await raceDashboardOperation(actual, {
					signal: handlerSignals.signal,
					onLateSettlement: (outcome) =>
						safeLog(module.logger, {
							event: `late-settlement-${outcome}`,
							requestId,
							dashboardId,
							panelId,
						}),
				});
				const data = isHandlerResultEnvelope(handlerResult)
					? handlerResult.data
					: handlerResult;
				const state = isHandlerResultEnvelope(handlerResult)
					? handlerResult.state
					: undefined;
				const normalized = normalizePanelResult({
					data,
					state,
					resolvedRange,
					intervalMs,
					maxDataPoints: parsed.data.maxDataPoints,
					fill: panel.manifest.visualization.fill,
				});
				const response = panelQueryResponseSchema.parse({
					requestId,
					generatedAt: operation.requestTime.toISOString(),
					resolvedRange: {
						from: resolvedRange.from.toISOString(),
						to: resolvedRange.to.toISOString(),
					},
					intervalMs,
					durationMs: Math.max(
						0,
						Math.round(module.clock.monotonicMs() - startedAt),
					),
					rowCount: normalized.rowCount,
					seriesCount: normalized.seriesCount,
					state: normalized.state,
					data: normalized.data,
				});
				return response;
			} catch (error) {
				if (error instanceof DashboardQueryError) throw error;
				if (error instanceof DashboardNormalizationError)
					throw new DashboardQueryError(error.code, error.message);
				if (operation.signal.aborted)
					throw new DashboardQueryError(
						"REQUEST_CANCELLED",
						"Dashboard query was cancelled",
					);
				if (error instanceof DashboardExecutionLimitError) {
					if (error.code === "REQUEST_CANCELLED")
						throw new DashboardQueryError(
							"REQUEST_CANCELLED",
							"Dashboard query was cancelled",
						);
					throw new DashboardQueryError(error.code, error.message, true);
				}
				if (composed?.signal.aborted) {
					if (timeout?.signal.aborted)
						throw new DashboardQueryError(
							"HANDLER_TIMEOUT",
							"Dashboard query timed out",
							true,
						);
					throw new DashboardQueryError(
						"REQUEST_CANCELLED",
						"Dashboard query was cancelled",
					);
				}
				throw new DashboardQueryError(
					"QUERY_FAILED",
					"Dashboard query failed",
					true,
				);
			} finally {
				if (!actualStarted) releaseSlot();
				composed?.dispose();
				timeout?.dispose();
			}
		},
	};
}

function isHandlerResultEnvelope(
	value: unknown,
): value is { data: unknown; state?: unknown } {
	return typeof value === "object" && value !== null && "data" in value;
}
