import {
	type DashboardErrorCodeV2,
	dashboardErrorResponseV2Schema,
	type PanelQueryRequestV2,
	panelQueryResponseV2Schema,
	publicDashboardManifestV2Schema,
	type VariableOptionsRequestV2,
	variableOptionsResponseV2Schema,
} from "@shared/schemas/dashboard.schema";
import { appFetch } from "../../../api";

export const DASHBOARD_V2_MEDIA_TYPE =
	"application/vnd.hono-standard.dashboard.v2+json";
export class DashboardApiErrorV2 extends Error {
	constructor(
		readonly code: DashboardErrorCodeV2,
		message: string,
		readonly retryable: boolean,
		readonly status: number,
		readonly requestId?: string,
		readonly details?: Record<string, unknown>,
		readonly cause?: unknown,
	) {
		super(message, { cause });
		this.name = "DashboardApiErrorV2";
	}
}

const parseResponse = async <T>(
	response: Response,
	schema: { parse: (value: unknown) => T },
	fallback: string,
): Promise<T> => {
	if (!response.ok) {
		let body: unknown;
		try {
			body = await response.json();
		} catch {
			/* safe fallback */
		}
		const parsed = dashboardErrorResponseV2Schema.safeParse(body);
		if (parsed.success) {
			const headerId = response.headers.get("X-Request-ID") ?? undefined;
			if (headerId && headerId !== parsed.data.error.requestId)
				throw new DashboardApiErrorV2(
					"INVALID_HANDLER_RESULT",
					"Dashboard request failed",
					false,
					response.status,
					headerId,
				);
			throw new DashboardApiErrorV2(
				parsed.data.error.code,
				parsed.data.error.message,
				parsed.data.error.retryable,
				response.status,
				parsed.data.error.requestId,
				parsed.data.error.details,
			);
		}
		throw new DashboardApiErrorV2(
			"INVALID_HANDLER_RESULT",
			fallback,
			false,
			response.status,
			response.headers.get("X-Request-ID") ?? undefined,
		);
	}
	try {
		const parsed = schema.parse(await response.json());
		const headerId = response.headers.get("X-Request-ID") ?? undefined;
		const bodyId =
			parsed &&
			typeof parsed === "object" &&
			"requestId" in parsed &&
			typeof parsed.requestId === "string"
				? parsed.requestId
				: undefined;
		if (headerId && bodyId && headerId !== bodyId)
			throw new DashboardApiErrorV2(
				"INVALID_HANDLER_RESULT",
				fallback,
				false,
				response.status,
				headerId,
			);
		return parsed;
	} catch (error) {
		if (error instanceof DashboardApiErrorV2) throw error;
		throw new DashboardApiErrorV2(
			"INVALID_HANDLER_RESULT",
			fallback,
			false,
			response.status,
			response.headers.get("X-Request-ID") ?? undefined,
			undefined,
			error,
		);
	}
};

const request = (path: string, init: RequestInit = {}) => {
	const headers = new Headers(init.headers);
	headers.set("Accept", DASHBOARD_V2_MEDIA_TYPE);
	if (init.body) headers.set("Content-Type", "application/json");
	return appFetch(path, { ...init, headers });
};
export const fetchDashboardManifestV2 = (
	dashboardId: string,
	signal?: AbortSignal,
) =>
	request(`/api/dashboards/${encodeURIComponent(dashboardId)}`, {
		signal,
	}).then((r) =>
		parseResponse(
			r,
			publicDashboardManifestV2Schema,
			"Dashboard manifest is invalid",
		),
	);
export const fetchVariableOptionsV2 = (
	dashboardId: string,
	variableId: string,
	body: VariableOptionsRequestV2,
	signal?: AbortSignal,
) =>
	request(
		`/api/dashboards/${encodeURIComponent(dashboardId)}/variables/${encodeURIComponent(variableId)}/options`,
		{ method: "POST", body: JSON.stringify(body), signal },
	).then((r) =>
		parseResponse(
			r,
			variableOptionsResponseV2Schema,
			"Variable options response is invalid",
		).then((response) => {
			if (response.variableId !== variableId)
				throw new DashboardApiErrorV2(
					"INVALID_HANDLER_RESULT",
					"Variable options response is invalid",
					false,
					r.status,
					r.headers.get("X-Request-ID") ?? undefined,
				);
			return response;
		}),
	);
export const fetchPanelQueryV2 = (
	dashboardId: string,
	panelId: string,
	body: PanelQueryRequestV2,
	signal?: AbortSignal,
) =>
	request(
		`/api/dashboards/${encodeURIComponent(dashboardId)}/panels/${encodeURIComponent(panelId)}/query`,
		{ method: "POST", body: JSON.stringify(body), signal },
	).then((r) =>
		parseResponse(r, panelQueryResponseV2Schema, "Panel response is invalid"),
	);
