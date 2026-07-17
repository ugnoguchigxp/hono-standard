import { describe, expect, it } from "vitest";
import { DashboardRuntimeError, dashboardQueryErrorToRuntimeError, asDashboardRuntimeError, invalidRequest, notFound, unsupportedVersion, requestCancelled, executionLimit, handlerTimeout, panelTimeout, invalidHandlerResult, queryFailed } from "./runtime-errors";

describe("dashboard runtime errors", () => {
	it("maps legacy errors to safe public messages", () => {
		const error = dashboardQueryErrorToRuntimeError({ code: "QUERY_FAILED", message: "secret SQL", retryable: true });
		expect(error).toBeInstanceOf(DashboardRuntimeError);
		expect(error.message).toBe("Dashboard request failed");
		expect(error.cause).toBeDefined();
		expect(asDashboardRuntimeError(new Error("secret")).message).toBe("Dashboard request failed");
	});
	it("keeps panel timeout separate from handler timeout", () => {
		const error = new DashboardRuntimeError("PANEL_TIMEOUT", 504, "Dashboard panel timed out", true);
		expect(error.code).toBe("PANEL_TIMEOUT");
	});
	it("provides safe factories for every boundary", () => {
		expect(invalidRequest().status).toBe(400);
		expect(notFound("DASHBOARD_NOT_FOUND").status).toBe(404);
		expect(unsupportedVersion().status).toBe(406);
		expect(requestCancelled().status).toBe(408);
		expect(executionLimit().status).toBe(429);
		expect(handlerTimeout().status).toBe(504);
		expect(panelTimeout().status).toBe(504);
		expect(invalidHandlerResult().status).toBe(422);
		expect(queryFailed().status).toBe(500);
		expect(dashboardQueryErrorToRuntimeError({ code: "DASHBOARD_NOT_FOUND" }).status).toBe(404);
		expect(dashboardQueryErrorToRuntimeError({ code: "EXECUTION_LIMIT_REACHED" }).status).toBe(429);
		expect(dashboardQueryErrorToRuntimeError({ code: "HANDLER_TIMEOUT" }).status).toBe(504);
		expect(dashboardQueryErrorToRuntimeError({ code: "REQUEST_CANCELLED" }).status).toBe(408);
		expect(dashboardQueryErrorToRuntimeError({ code: "INVALID_REQUEST" }).status).toBe(400);
		expect(dashboardQueryErrorToRuntimeError({ code: "INVALID_HANDLER_RESULT" }).status).toBe(422);
	});
});
