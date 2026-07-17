import { Hono } from "hono";
import { z } from "zod";
import {
	type DashboardErrorResponse,
	dashboardEntityIdSchema,
} from "../../shared/schemas/dashboard.schema";
import { getAuthContextUser } from "../modules/auth/context";
import type { DashboardModule } from "../modules/dashboard";
import {
	asDashboardRuntimeError,
	DashboardRuntimeError,
	invalidRequest,
} from "../modules/dashboard/runtime-errors";
import {
	DASHBOARD_V2_MEDIA_TYPE,
	detectDashboardRequestVersion,
	negotiateDashboardAccept,
} from "./dashboard-version";

type DashboardRouteDeps = { dashboard: DashboardModule };
const idParam = z.object({ dashboardId: dashboardEntityIdSchema });
const panelParam = z.object({
	dashboardId: dashboardEntityIdSchema,
	panelId: dashboardEntityIdSchema,
});
const variableParam = z.object({
	dashboardId: dashboardEntityIdSchema,
	variableId: dashboardEntityIdSchema,
});

export function createDashboardRoute(deps: DashboardRouteDeps) {
	const route = new Hono();
	route.get("/:dashboardId", async (c) => {
		const requestId = deps.dashboard.requestIdFactory();
		c.header("X-Request-ID", requestId);
		c.header("Vary", "Accept");
		try {
			const params = idParam.parse(c.req.param());
			const auth = getAuthContextUser(c);
			const version = negotiateDashboardAccept(c.req.header("Accept"));
			const response = await deps.dashboard.service.getManifest({
				requestId,
				requestTime: deps.dashboard.clock.now(),
				auth,
				dashboardId: params.dashboardId,
				transportVersion: version,
				signal: c.req.raw.signal,
			});
			return c.json(response);
		} catch (error) {
			return renderError(c, requestId, error, c.req.raw.signal);
		}
	});

	route.post("/:dashboardId/variables/:variableId/options", async (c) => {
		const requestId = deps.dashboard.requestIdFactory();
		c.header("X-Request-ID", requestId);
		try {
			const params = variableParam.parse(c.req.param());
			const auth = getAuthContextUser(c);
			const body = await readJson(c);
			const version = detectDashboardRequestVersion(body);
			const accept = c.req.header("Accept");
			if (accept && negotiateDashboardAccept(accept) === 2 && version !== 2)
				throw new DashboardRuntimeError(
					"SCHEMA_VERSION_UNSUPPORTED",
					400,
					"Dashboard schema version is not supported",
					false,
				);
			const response = await deps.dashboard.service.getVariableOptions({
				requestId,
				requestTime: deps.dashboard.clock.now(),
				auth,
				dashboardId: params.dashboardId,
				variableId: params.variableId,
				transportVersion: version,
				request: body,
				signal: c.req.raw.signal,
			});
			return c.json(response);
		} catch (error) {
			return renderError(c, requestId, error, c.req.raw.signal);
		}
	});

	route.post("/:dashboardId/panels/:panelId/query", async (c) => {
		const requestId = deps.dashboard.requestIdFactory();
		c.header("X-Request-ID", requestId);
		try {
			const params = panelParam.parse(c.req.param());
			const auth = getAuthContextUser(c);
			const body = await readJson(c);
			const version = detectDashboardRequestVersion(body);
			const accept = c.req.header("Accept");
			if (accept && negotiateDashboardAccept(accept) === 2 && version !== 2)
				throw new DashboardRuntimeError(
					"SCHEMA_VERSION_UNSUPPORTED",
					400,
					"Dashboard schema version is not supported",
					false,
				);
			const response = await deps.dashboard.service.queryPanel({
				requestId,
				requestTime: deps.dashboard.clock.now(),
				auth,
				dashboardId: params.dashboardId,
				panelId: params.panelId,
				transportVersion: version,
				request: body,
				signal: c.req.raw.signal,
			});
			return c.json(response);
		} catch (error) {
			return renderError(c, requestId, error, c.req.raw.signal);
		}
	});
	return route;
}

async function readJson(c: {
	req: { header(name: string): string | undefined; json(): Promise<unknown> };
}): Promise<unknown> {
	const contentType = c.req.header("Content-Type")?.toLowerCase();
	const mediaType = contentType?.split(";", 1)[0]?.trim();
	if (mediaType !== "application/json")
		throw new DashboardRuntimeError(
			"INVALID_REQUEST",
			400,
			"Invalid dashboard request",
			false,
		);
	try {
		return await c.req.json();
	} catch (error) {
		throw new DashboardRuntimeError(
			"INVALID_REQUEST",
			400,
			"Invalid dashboard request",
			false,
			undefined,
			error,
		);
	}
}

function renderError(
	c: {
		header(name: string, value: string): void;
		json(body: DashboardErrorResponse, status: number): Response;
		body(data: null, status: 408): Response;
	},
	requestId: string,
	error: unknown,
	requestSignal: AbortSignal,
) {
	if (requestSignal.aborted) return c.body(null, 408);
	if (
		error &&
		typeof error === "object" &&
		"status" in error &&
		(error as { status?: unknown }).status === 401
	)
		return c.json(
			{
				error: {
					code: "INVALID_REQUEST",
					message: "Unauthorized",
					requestId,
					retryable: false,
				},
			} as DashboardErrorResponse,
			401,
		);
	const runtime =
		error &&
		typeof error === "object" &&
		(error as { name?: unknown }).name === "ZodError"
			? invalidRequest(error)
			: asDashboardRuntimeError(error);
	if (runtime.code === "EXECUTION_LIMIT_REACHED") c.header("Retry-After", "1");
	const body = {
		error: {
			code: runtime.code as DashboardErrorResponse["error"]["code"],
			message: runtime.message,
			requestId,
			retryable: runtime.retryable,
		},
	} as DashboardErrorResponse;
	return c.json(body, runtime.status);
}

export { DASHBOARD_V2_MEDIA_TYPE };
