import type { DashboardJsonObject } from "../../../shared/schemas/dashboard.schema";
import type { DashboardErrorCodeV2 } from "../../../shared/schemas/dashboard.schema";

export type DashboardRuntimeErrorCode =
	| DashboardErrorCodeV2
	| "INVALID_REQUEST"
	| "DASHBOARD_NOT_FOUND"
	| "PANEL_NOT_FOUND"
	| "VARIABLE_NOT_FOUND"
	| "VARIABLE_DEPENDENCY_INVALID"
	| "HANDLER_TIMEOUT"
	| "REQUEST_CANCELLED"
	| "EXECUTION_LIMIT_REACHED"
	| "QUERY_FAILED"
	| "INVALID_HANDLER_RESULT"
	| "INVALID_DATA_FRAME"
	| "FRAME_LIMIT_EXCEEDED"
	| "FIELD_LIMIT_EXCEEDED"
	| "CELL_LIMIT_EXCEEDED";

export type DashboardRuntimeStatus =
	| 400
	| 404
	| 406
	| 408
	| 422
	| 429
	| 500
	| 504;

const safeMessages: Record<string, string> = {
	INVALID_REQUEST: "Invalid dashboard request",
	DASHBOARD_NOT_FOUND: "Dashboard not found",
	PANEL_NOT_FOUND: "Panel not found",
	VARIABLE_NOT_FOUND: "Variable not found",
	VARIABLE_DEPENDENCY_INVALID: "Invalid variable dependencies",
	SCHEMA_VERSION_UNSUPPORTED: "Dashboard schema version is not supported",
	EXECUTION_LIMIT_REACHED: "Dashboard execution limit reached",
	HANDLER_TIMEOUT: "Dashboard handler timed out",
	PANEL_TIMEOUT: "Dashboard panel timed out",
	REQUEST_CANCELLED: "Dashboard request was cancelled",
	INVALID_HANDLER_RESULT: "Dashboard handler returned an invalid result",
	INVALID_DATA_FRAME: "Dashboard data frame is invalid",
	FRAME_LIMIT_EXCEEDED: "Dashboard frame limit exceeded",
	FIELD_LIMIT_EXCEEDED: "Dashboard field limit exceeded",
	CELL_LIMIT_EXCEEDED: "Dashboard cell limit exceeded",
	QUERY_FAILED: "Dashboard request failed",
};

export class DashboardRuntimeError extends Error {
	readonly name = "DashboardRuntimeError";
	constructor(
		readonly code: DashboardRuntimeErrorCode,
		readonly status: DashboardRuntimeStatus,
		message: string,
		readonly retryable: boolean,
		readonly details?: DashboardJsonObject,
		readonly cause?: unknown,
	) {
		super(message);
	}
}

export const runtimeError = (
	code: DashboardRuntimeErrorCode,
	status: DashboardRuntimeStatus,
	retryable = false,
	details?: DashboardJsonObject,
	cause?: unknown,
) =>
	new DashboardRuntimeError(
		code,
		status,
		safeMessages[code] ?? "Dashboard request failed",
		retryable,
		details,
		cause,
	);

export const invalidRequest = (cause?: unknown) =>
	runtimeError("INVALID_REQUEST", 400, false, undefined, cause);
export const notFound = (
	code: "DASHBOARD_NOT_FOUND" | "PANEL_NOT_FOUND" | "VARIABLE_NOT_FOUND",
) => runtimeError(code, 404);
export const unsupportedVersion = (status: 400 | 406 = 406) =>
	runtimeError("SCHEMA_VERSION_UNSUPPORTED", status);
export const requestCancelled = (cause?: unknown) =>
	runtimeError("REQUEST_CANCELLED", 408, false, undefined, cause);
export const executionLimit = (cause?: unknown) =>
	runtimeError("EXECUTION_LIMIT_REACHED", 429, true, undefined, cause);
export const handlerTimeout = (cause?: unknown) =>
	runtimeError("HANDLER_TIMEOUT", 504, true, undefined, cause);
export const panelTimeout = (cause?: unknown) =>
	runtimeError("PANEL_TIMEOUT", 504, true, undefined, cause);
export const invalidHandlerResult = (cause?: unknown) =>
	runtimeError("INVALID_HANDLER_RESULT", 422, false, undefined, cause);
export const queryFailed = (cause?: unknown, retryable = true) =>
	runtimeError("QUERY_FAILED", 500, retryable, undefined, cause);

export function dashboardQueryErrorToRuntimeError(error: {
	code: string;
	message?: string;
	retryable?: boolean;
}): DashboardRuntimeError {
	const code = error.code as DashboardRuntimeErrorCode;
	if (
		code === "DASHBOARD_NOT_FOUND" ||
		code === "PANEL_NOT_FOUND" ||
		code === "VARIABLE_NOT_FOUND"
	)
		return runtimeError(code, 404, false, undefined, error);
	if (code === "EXECUTION_LIMIT_REACHED") return executionLimit(error);
	if (code === "HANDLER_TIMEOUT") return handlerTimeout(error);
	if (code === "PANEL_TIMEOUT") return panelTimeout(error);
	if (code === "REQUEST_CANCELLED") return requestCancelled(error);
	if (code === "INVALID_REQUEST") return invalidRequest(error);
	if (code === "VARIABLE_DEPENDENCY_INVALID")
		return runtimeError(code, 400, false, undefined, error);
	if (code === "SCHEMA_VERSION_UNSUPPORTED") return unsupportedVersion();
	if (code === "INVALID_HANDLER_RESULT") return invalidHandlerResult(error);
	if (
		code === "INVALID_DATA_FRAME" ||
		code === "FRAME_LIMIT_EXCEEDED" ||
		code === "FIELD_LIMIT_EXCEEDED" ||
		code === "CELL_LIMIT_EXCEEDED" ||
		code === "VISUALIZATION_NOT_REGISTERED" ||
		code === "VISUALIZATION_CONFIG_INVALID" ||
		code === "INCOMPATIBLE_VISUALIZATION" ||
		code === "TRANSFORMATION_NOT_REGISTERED" ||
		code === "TRANSFORMATION_CONFIG_INVALID"
	)
		return runtimeError(code, 422, false, undefined, error);
	return queryFailed(error, error.retryable ?? true);
}

export function asDashboardRuntimeError(error: unknown): DashboardRuntimeError {
	if (error instanceof DashboardRuntimeError) return error;
	if (error && typeof error === "object" && "code" in error) {
		const value = error as {
			code?: unknown;
			retryable?: unknown;
			message?: unknown;
		};
		if (typeof value.code === "string")
			return dashboardQueryErrorToRuntimeError({
				code: value.code,
				retryable:
					typeof value.retryable === "boolean" ? value.retryable : undefined,
				message: typeof value.message === "string" ? value.message : undefined,
			});
	}
	return queryFailed(error);
}
