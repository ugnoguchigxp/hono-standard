import {
	legacyPanelQueryResponseToV2,
	legacyPublicDashboardManifestToV2,
	legacyVariableOptionsResponseToV2,
	type PanelQueryResponse,
	type PanelQueryResponseV2,
	type PublicDashboardManifest,
	type PublicDashboardManifestV2,
	panelQueryRequestSchema,
	panelQueryRequestV2Schema,
	publicDashboardManifestSchema,
	type VariableOptionsRequest,
	type VariableOptionsResponse,
	type VariableOptionsResponseV2,
	variableOptionsRequestSchema,
	variableOptionsRequestV2Schema,
} from "../../../shared/schemas/dashboard.schema";
import {
	composeAbortSignals,
	raceDashboardOperation,
	timeoutSignal,
} from "./abort-signals";
import type { DashboardModule } from "./index";
import { resolveDashboardRange } from "./interval";
import { createDashboardQueryExecutor } from "./query-executor";
import {
	asDashboardRuntimeError,
	DashboardRuntimeError,
	invalidRequest,
} from "./runtime-errors";
import { safeLog } from "./runtime-logger";
import type { DashboardAuthContext } from "./types";
import type { DashboardRegistryV2 } from "./v2/dashboard-registry";
import { queryPanelV2 } from "./v2/query-coordinator";
import type { DashboardTransformationRegistry } from "./v2/transformation-registry";
import { getVariableOptionsV2 } from "./v2/variable-options-executor";

export type DashboardTransportVersion = 1 | 2;
export type DashboardService = {
	getManifest(
		input: ServiceInput,
	): Promise<PublicDashboardManifest | PublicDashboardManifestV2>;
	getVariableOptions(
		input: ServiceInput & { variableId: string; request: unknown },
	): Promise<VariableOptionsResponse | VariableOptionsResponseV2>;
	queryPanel(
		input: ServiceInput & { panelId: string; request: unknown },
	): Promise<PanelQueryResponse | PanelQueryResponseV2>;
};
type ServiceInput = {
	requestId: string;
	requestTime: Date;
	auth: DashboardAuthContext;
	dashboardId: string;
	transportVersion: DashboardTransportVersion;
	signal: AbortSignal;
};

export function createDashboardService(options: {
	module: DashboardModule;
	v2: DashboardRegistryV2;
	transformations: DashboardTransformationRegistry;
}): DashboardService {
	const executor = createDashboardQueryExecutor(options.module);
	const core: DashboardService = {
		async getManifest(input) {
			const legacy = options.module.registry.getManifest(input.dashboardId);
			const native = options.v2.get(input.dashboardId);
			if (!legacy && !native)
				throw new DashboardRuntimeError(
					"DASHBOARD_NOT_FOUND",
					404,
					"Dashboard not found",
					false,
				);
			if (native) {
				if (input.transportVersion !== 2)
					throw new DashboardRuntimeError(
						"SCHEMA_VERSION_UNSUPPORTED",
						406,
						"Dashboard schema version is not supported",
						false,
					);
				return options.v2.getPublicManifest(
					input.dashboardId,
				) as PublicDashboardManifestV2;
			}
			const publicManifest = publicDashboardManifestSchema.parse({
				...legacy,
				variables: legacy?.variables.map((variable) => ({
					...variable,
					source:
						variable.source.kind === "static"
							? { kind: "static" }
							: variable.source,
				})),
			});
			return input.transportVersion === 2
				? legacyPublicDashboardManifestToV2(publicManifest)
				: publicManifest;
		},
		async getVariableOptions(input) {
			const native = options.v2.get(input.dashboardId);
			if (native) {
				if (input.transportVersion !== 2)
					throw new DashboardRuntimeError(
						"SCHEMA_VERSION_UNSUPPORTED",
						406,
						"Dashboard schema version is not supported",
						false,
					);
				const request = parseClientRequest(
					variableOptionsRequestV2Schema,
					input.request,
				);
				return getVariableOptionsV2({
					...input,
					module: options.module,
					registry: options.v2,
					request,
				});
			}
			const variable = options.module.registry.getVariable(
				input.dashboardId,
				input.variableId,
			);
			if (!options.module.registry.get(input.dashboardId))
				throw new DashboardRuntimeError(
					"DASHBOARD_NOT_FOUND",
					404,
					"Dashboard not found",
					false,
				);
			if (!variable)
				throw new DashboardRuntimeError(
					"VARIABLE_NOT_FOUND",
					404,
					"Variable not found",
					false,
				);
			if (input.transportVersion === 2) {
				const request = parseClientRequest(
					variableOptionsRequestV2Schema,
					input.request,
				);
				const legacyRequest = {
					range: request.range,
					timezone: request.timezone,
					filters: request.filters,
				} as VariableOptionsRequest;
				const response = await legacyVariableOptions(
					options.module,
					input,
					variable.manifest.dependsOn,
					legacyRequest,
				);
				return legacyVariableOptionsResponseToV2(response);
			}
			return legacyVariableOptions(
				options.module,
				input,
				variable.manifest.dependsOn,
				parseClientRequest(variableOptionsRequestSchema, input.request),
			);
		},
		async queryPanel(input) {
			const native = options.v2.get(input.dashboardId);
			if (native) {
				if (input.transportVersion !== 2)
					throw new DashboardRuntimeError(
						"SCHEMA_VERSION_UNSUPPORTED",
						406,
						"Dashboard schema version is not supported",
						false,
					);
				return queryPanelV2({
					...input,
					module: options.module,
					registry: options.v2,
					transformations: options.transformations,
					request: parseClientRequest(panelQueryRequestV2Schema, input.request),
				});
			}
			if (!options.module.registry.get(input.dashboardId))
				throw new DashboardRuntimeError(
					"DASHBOARD_NOT_FOUND",
					404,
					"Dashboard not found",
					false,
				);
			const panel = options.module.registry.getPanel(
				input.dashboardId,
				input.panelId,
			);
			if (!panel)
				throw new DashboardRuntimeError(
					"PANEL_NOT_FOUND",
					404,
					"Panel not found",
					false,
				);
			if (input.transportVersion === 2) {
				const request = parseClientRequest(
					panelQueryRequestV2Schema,
					input.request,
				);
				const response = await executor.queryWithContext(
					input.dashboardId,
					input.panelId,
					{
						range: request.range,
						timezone: request.timezone,
						filters: request.filters,
						maxDataPoints: request.maxDataPoints,
					},
					{
						requestId: input.requestId,
						requestTime: input.requestTime,
						auth: input.auth,
						signal: input.signal,
					},
				);
				return legacyPanelQueryResponseToV2(response, {
					refId: "A",
					queryRefId: "A",
					frameName: panel.manifest.title,
				});
			}
			return executor.queryWithContext(
				input.dashboardId,
				input.panelId,
				parseClientRequest(panelQueryRequestSchema, input.request),
				{
					requestId: input.requestId,
					requestTime: input.requestTime,
					auth: input.auth,
					signal: input.signal,
				},
			);
		},
	};
	return {
		getManifest: (input) =>
			withRuntimeLogging(options.module, input, () => core.getManifest(input)),
		getVariableOptions: (input) =>
			withRuntimeLogging(options.module, input, () =>
				core.getVariableOptions(input),
			),
		queryPanel: (input) =>
			withRuntimeLogging(options.module, input, () => core.queryPanel(input)),
	};
}

async function withRuntimeLogging<T>(
	module: DashboardModule,
	input: ServiceInput & { panelId?: string; variableId?: string },
	run: () => Promise<T>,
): Promise<T> {
	const started = module.clock.monotonicMs();
	const identity = {
		requestId: input.requestId,
		dashboardId: input.dashboardId,
		...(input.panelId === undefined ? {} : { panelId: input.panelId }),
		...(input.variableId === undefined ? {} : { variableId: input.variableId }),
	};
	safeLog(module.logger, {
		event: "start",
		...identity,
	});
	try {
		const result = await run();
		const counts = operationCounts(result);
		safeLog(module.logger, {
			event: "success",
			...identity,
			durationMs: Math.max(0, Math.round(module.clock.monotonicMs() - started)),
			...counts,
		});
		return result;
	} catch (error) {
		const runtime = asDashboardRuntimeError(error);
		safeLog(
			module.logger,
			{
				event: "failure",
				...identity,
				errorCode: runtime.code,
			},
			error,
		);
		throw runtime;
	}
}

function operationCounts(value: unknown): {
	frameCount?: number;
	fieldCount?: number;
	rowCount?: number;
	cellCount?: number;
} {
	if (!value || typeof value !== "object") return {};
	const record = value as Record<string, unknown>;
	const counts = record.counts;
	if (counts && typeof counts === "object") {
		const source = counts as Record<string, unknown>;
		if (
			typeof source.frames === "number" &&
			typeof source.fields === "number" &&
			typeof source.rows === "number" &&
			typeof source.cells === "number"
		)
			return {
				frameCount: source.frames,
				fieldCount: source.fields,
				rowCount: source.rows,
				cellCount: source.cells,
			};
	}
	if (typeof record.rowCount === "number") return { rowCount: record.rowCount };
	if (Array.isArray(record.options)) return { rowCount: record.options.length };
	return {};
}

function parseClientRequest<T>(
	schema: { parse(value: unknown): T },
	value: unknown,
): T {
	try {
		return schema.parse(value);
	} catch (error) {
		throw invalidRequest(error);
	}
}

async function legacyVariableOptions(
	module: DashboardModule,
	input: ServiceInput & { variableId: string },
	dependsOnKeys: string[],
	request: VariableOptionsRequest,
): Promise<VariableOptionsResponse> {
	const variable = module.registry.getVariable(
		input.dashboardId,
		input.variableId,
	);
	if (!variable)
		throw new DashboardRuntimeError(
			"VARIABLE_NOT_FOUND",
			404,
			"Variable not found",
			false,
		);
	const resolvedRange = resolveDashboardRange(
		request.range,
		() => input.requestTime,
	);
	const filters = Object.fromEntries(
		dependsOnKeys
			.filter((key) => request.filters[key])
			.map((key) => [key, request.filters[key]]),
	);
	const context = {
		requestId: input.requestId,
		requestTime: input.requestTime,
		auth: input.auth,
		range: resolvedRange,
		timezone: request.timezone,
		dependsOn: filters,
		filters,
		signal: input.signal,
		now: () => input.requestTime,
	};
	try {
		if (input.signal.aborted)
			throw new DashboardRuntimeError(
				"REQUEST_CANCELLED",
				408,
				"Dashboard request was cancelled",
				false,
			);
		if (variable.manifest.source.kind === "static")
			return {
				variableId: input.variableId,
				options: await module.registry.getVariableOptions(
					input.dashboardId,
					input.variableId,
					context,
				),
			};
		const release = await module.limiter.acquire(input.signal);
		let actualStarted = false;
		let slotReleased = false;
		const releaseSlot = () => {
			if (slotReleased) return;
			slotReleased = true;
			release();
		};
		try {
			const timeout = timeoutSignal(module.limits.handlerTimeoutMs);
			const composed = composeAbortSignals([input.signal, timeout.signal]);
			try {
				const actual = Promise.resolve(
					module.registry.getVariableOptions(
						input.dashboardId,
						input.variableId,
						{ ...context, signal: composed.signal },
					),
				);
				actualStarted = true;
				actual.then(releaseSlot, releaseSlot);
				return {
					variableId: input.variableId,
					options: await raceDashboardOperation(actual, {
						signal: composed.signal,
						onLateSettlement: (outcome) =>
							safeLog(module.logger, {
								event: `late-settlement-${outcome}`,
								requestId: input.requestId,
								dashboardId: input.dashboardId,
								variableId: input.variableId,
							}),
					}),
				};
			} catch (error) {
				if (timeout.signal.aborted)
					throw new DashboardRuntimeError(
						"HANDLER_TIMEOUT",
						504,
						"Dashboard handler timed out",
						true,
						undefined,
						error,
					);
				throw error;
			} finally {
				composed.dispose();
				timeout.dispose();
			}
		} finally {
			if (!actualStarted) releaseSlot();
		}
	} catch (error) {
		if (input.signal.aborted)
			throw new DashboardRuntimeError(
				"REQUEST_CANCELLED",
				408,
				"Dashboard request was cancelled",
				false,
				undefined,
				error,
			);
		throw asDashboardRuntimeError(error);
	}
}
