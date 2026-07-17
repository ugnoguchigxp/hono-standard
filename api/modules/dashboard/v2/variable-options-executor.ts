import {
	DASHBOARD_V2_LIMITS,
	type VariableOptionsRequestV2,
	type VariableOptionsResponseV2,
	type VariableOptionV2,
	variableOptionsResponseV2Schema,
	variableOptionV2Schema,
} from "../../../../shared/schemas/dashboard.schema";
import {
	composeAbortSignals,
	getAbortKind,
	raceDashboardOperation,
} from "../abort-signals";
import type { DashboardModule } from "../index";
import { resolveDashboardRange } from "../interval";
import { DashboardRuntimeError } from "../runtime-errors";
import { safeLog } from "../runtime-logger";
import type { DashboardAuthContext } from "../types";
import type { DashboardRegistryV2 } from "./dashboard-registry";

export async function getVariableOptionsV2(input: {
	module: DashboardModule;
	registry: DashboardRegistryV2;
	requestId: string;
	requestTime: Date;
	auth: DashboardAuthContext;
	dashboardId: string;
	variableId: string;
	request: VariableOptionsRequestV2;
	signal: AbortSignal;
}): Promise<VariableOptionsResponseV2> {
	const variable = input.registry.getVariable(
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
		input.request.range as never,
		() => input.requestTime,
	);
	const dependsOn = input.registry.validateVariableDependencyFilters(
		input.dashboardId,
		input.variableId,
		input.request.filters,
	);
	let options: unknown;
	if (variable.manifest.source.kind === "static") {
		if (input.signal.aborted)
			throw new DashboardRuntimeError(
				"REQUEST_CANCELLED",
				408,
				"Dashboard request was cancelled",
				false,
			);
		options = structuredClone(variable.manifest.source.options);
	} else {
		if (!variable.options)
			throw new DashboardRuntimeError(
				"QUERY_FAILED",
				500,
				"Dashboard request failed",
				true,
			);
		let release: (() => void) | undefined;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let composed: ReturnType<typeof composeAbortSignals> | undefined;
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
			composed = composeAbortSignals([input.signal, handlerController.signal]);
			const actual = Promise.resolve().then(() =>
				variable.options?.({
					requestId: input.requestId,
					requestTime: input.requestTime,
					dashboardId: input.dashboardId,
					variableId: input.variableId,
					resolvedRange,
					timezone: input.request.timezone,
					dependsOn,
					filters: dependsOn,
					auth: input.auth,
					signal: composed?.signal ?? input.signal,
				}),
			);
			actualStarted = true;
			actual.then(releaseSlot, releaseSlot);
			options = await raceDashboardOperation(actual, {
				signal: composed.signal,
				onLateSettlement: (outcome) =>
					safeLog(input.module.logger, {
						event: `late-settlement-${outcome}`,
						requestId: input.requestId,
						dashboardId: input.dashboardId,
						variableId: input.variableId,
					}),
			});
		} catch (error) {
			if (error instanceof DashboardRuntimeError) throw error;
			if (getAbortKind(composed?.signal ?? input.signal) === "handler-timeout")
				throw new DashboardRuntimeError(
					"HANDLER_TIMEOUT",
					504,
					"Dashboard handler timed out",
					true,
					undefined,
					error,
				);
			if (
				input.signal.aborted ||
				(error &&
					typeof error === "object" &&
					"code" in error &&
					(error as { code?: unknown }).code === "REQUEST_CANCELLED")
			)
				throw new DashboardRuntimeError(
					"REQUEST_CANCELLED",
					408,
					"Dashboard request was cancelled",
					false,
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
	if (!Array.isArray(options))
		throw new DashboardRuntimeError(
			"INVALID_HANDLER_RESULT",
			422,
			"Dashboard handler returned invalid options",
			false,
		);
	const parsed = options.map((option) =>
		variableOptionV2Schema.safeParse(option),
	);
	if (parsed.some((value) => !value.success))
		throw new DashboardRuntimeError(
			"INVALID_HANDLER_RESULT",
			422,
			"Dashboard handler returned invalid options",
			false,
		);
	const values: VariableOptionV2[] = parsed.map(
		(value) => (value as { success: true; data: VariableOptionV2 }).data,
	);
	if (new Set(values.map((option) => option.value)).size !== values.length)
		throw new DashboardRuntimeError(
			"INVALID_HANDLER_RESULT",
			422,
			"Dashboard options contain duplicate values",
			false,
		);
	if (values.length > DASHBOARD_V2_LIMITS.maxVariableOptions)
		throw new DashboardRuntimeError(
			"FRAME_LIMIT_EXCEEDED",
			422,
			"Dashboard options limit exceeded",
			false,
		);
	const sorted = [...values].sort(
		(left, right) =>
			compareText(left.label, right.label) ||
			compareText(left.value, right.value),
	);
	if (
		variable.manifest.required &&
		variable.manifest.defaultValues.some(
			(value) => !sorted.some((option) => option.value === value),
		)
	)
		throw new DashboardRuntimeError(
			"INVALID_HANDLER_RESULT",
			422,
			"Required variable default is unavailable",
			false,
		);
	return variableOptionsResponseV2Schema.parse({
		schemaVersion: 2,
		variableId: input.variableId,
		options: sorted,
	});
}

function compareText(left: string, right: string) {
	return left < right ? -1 : left > right ? 1 : 0;
}
