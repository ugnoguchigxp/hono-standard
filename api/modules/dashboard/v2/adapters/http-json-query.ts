import type { z } from "zod";
import {
	type DashboardDataShape,
	type DashboardJsonValue,
	validateDashboardJsonValue,
} from "../../../../../shared/schemas/dashboard.schema";
import { DashboardRuntimeError } from "../../runtime-errors";
import type {
	DashboardQueryDefinitionV2,
	DashboardQueryHandlerContextV2,
} from "../types";
import type {
	DashboardRecordColumn,
	DashboardRecordOverflowPolicy,
} from "./record-adapter";
import { defineRecordQueryV2 } from "./record-query";

export const DEFAULT_DASHBOARD_HTTP_RESPONSE_BYTES = 2 * 1024 * 1024;
export const MAX_DASHBOARD_HTTP_RESPONSE_BYTES = 8 * 1024 * 1024;

export type DashboardFetch = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;

const forbiddenRequestHeaders = new Set([
	"accept",
	"connection",
	"content-length",
	"content-type",
	"cookie",
	"host",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
]);

export type DashboardHttpJsonRequestV2 = {
	path: string;
	method?: "GET" | "POST";
	search?: Readonly<Record<string, string | readonly string[] | undefined>>;
	headers?: Readonly<Record<string, string>>;
	body?: DashboardJsonValue;
};

export type DefineHttpJsonRecordQueryInputV2<TResponse, TRow extends object> = {
	id: string;
	filterKeys: readonly string[];
	baseUrl: string | URL;
	outputShape?: DashboardDataShape;
	frameName: string;
	columns: readonly DashboardRecordColumn<TRow>[];
	overflow?: DashboardRecordOverflowPolicy;
	responseSchema: z.ZodType<TResponse>;
	request: (
		context: DashboardQueryHandlerContextV2,
	) => DashboardHttpJsonRequestV2;
	selectRecords: (
		response: TResponse,
		context: DashboardQueryHandlerContextV2,
	) => readonly TRow[];
	maxResponseBytes?: number;
	fetch?: DashboardFetch;
};

export function defineHttpJsonRecordQueryV2<TResponse, TRow extends object>(
	input: DefineHttpJsonRecordQueryInputV2<TResponse, TRow>,
): DashboardQueryDefinitionV2 {
	const baseUrl = validateBaseUrl(input.baseUrl);
	const maxResponseBytes = validateResponseByteLimit(input.maxResponseBytes);
	const fetchImplementation = input.fetch ?? globalThis.fetch;
	if (typeof fetchImplementation !== "function")
		throw new TypeError("A fetch implementation is required");

	return defineRecordQueryV2({
		id: input.id,
		filterKeys: input.filterKeys,
		outputShape: input.outputShape,
		frameName: input.frameName,
		columns: input.columns,
		overflow: input.overflow,
		load: async (context) => {
			let request: ReturnType<typeof buildRequest>;
			try {
				request = buildRequest(baseUrl, input.request(context));
			} catch (error) {
				throw queryFailure(false, error);
			}
			let response: Response;
			try {
				response = await fetchImplementation(request.url, {
					method: request.method,
					headers: request.headers,
					body: request.body,
					redirect: "error",
					signal: context.signal,
				});
			} catch (error) {
				if (context.signal.aborted)
					throw requestCancelled(context.signal, error);
				throw queryFailure(true, error);
			}
			if (!response.ok)
				throw queryFailure(
					response.status === 408 ||
						response.status === 429 ||
						response.status >= 500,
				);
			if (!isJsonMediaType(response.headers.get("content-type")))
				throw queryFailure(false);

			const bytes = await readResponseBytes(
				response,
				maxResponseBytes,
				context.signal,
			);
			let json: unknown;
			try {
				json = JSON.parse(
					new TextDecoder("utf-8", { fatal: true }).decode(bytes),
				);
			} catch (error) {
				throw queryFailure(false, error);
			}
			const parsed = input.responseSchema.safeParse(json);
			if (!parsed.success) throw queryFailure(false, parsed.error);
			try {
				return input.selectRecords(parsed.data, context);
			} catch (error) {
				throw queryFailure(false, error);
			}
		},
	});
}

function validateBaseUrl(input: string | URL): URL {
	let url: URL;
	try {
		url = new URL(input.toString());
	} catch (error) {
		throw new TypeError("Dashboard HTTP base URL is invalid", { cause: error });
	}
	if (url.protocol !== "http:" && url.protocol !== "https:")
		throw new TypeError("Dashboard HTTP base URL must use HTTP or HTTPS");
	if (
		url.username !== "" ||
		url.password !== "" ||
		url.search !== "" ||
		url.hash !== "" ||
		url.pathname !== "/"
	)
		throw new TypeError("Dashboard HTTP base URL must contain only an origin");
	return new URL(url.origin);
}

function validateResponseByteLimit(input: number | undefined): number {
	const value = input ?? DEFAULT_DASHBOARD_HTTP_RESPONSE_BYTES;
	if (
		!Number.isSafeInteger(value) ||
		value < 1 ||
		value > MAX_DASHBOARD_HTTP_RESPONSE_BYTES
	)
		throw new TypeError("Dashboard HTTP response byte limit is invalid");
	return value;
}

function buildRequest(
	baseUrl: URL,
	input: DashboardHttpJsonRequestV2,
): { url: URL; method: "GET" | "POST"; headers: Headers; body?: string } {
	if (!input.path.startsWith("/") || input.path.startsWith("//"))
		throw new TypeError("Dashboard HTTP request path must be origin-relative");
	if (input.path.includes("?") || input.path.includes("#"))
		throw new TypeError("Dashboard HTTP request search must be explicit");
	const url = new URL(input.path, baseUrl);
	if (url.origin !== baseUrl.origin)
		throw new TypeError("Dashboard HTTP request origin is not allowed");
	url.search = "";
	for (const key of Object.keys(input.search ?? {}).sort()) {
		const value = input.search?.[key];
		if (value === undefined) continue;
		for (const item of Array.isArray(value) ? value : [value])
			url.searchParams.append(key, item);
	}

	const method = input.method ?? "GET";
	if (method !== "GET" && method !== "POST")
		throw new TypeError("Dashboard HTTP method is not allowed");
	if (method === "GET" && input.body !== undefined)
		throw new TypeError("Dashboard HTTP GET requests cannot have a body");

	const headers = new Headers();
	for (const [key, value] of Object.entries(input.headers ?? {})) {
		if (forbiddenRequestHeaders.has(key.toLowerCase()))
			throw new TypeError("Dashboard HTTP request header is not allowed");
		headers.set(key, value);
	}
	headers.set("Accept", "application/json");
	let body: string | undefined;
	if (method === "POST") {
		if (input.body !== undefined) {
			const validation = validateDashboardJsonValue(input.body);
			if (!validation.valid)
				throw new TypeError("Dashboard HTTP request body is invalid");
			body = JSON.stringify(input.body);
		}
		headers.set("Content-Type", "application/json");
	}
	return { url, method, headers, ...(body === undefined ? {} : { body }) };
}

function isJsonMediaType(value: string | null): boolean {
	if (!value) return false;
	const mediaType = value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
	return mediaType === "application/json" || mediaType.endsWith("+json");
}

async function readResponseBytes(
	response: Response,
	limit: number,
	signal: AbortSignal,
): Promise<Uint8Array> {
	const declaredLength = response.headers.get("content-length");
	if (
		declaredLength !== null &&
		(/^\d+$/.test(declaredLength) === false || Number(declaredLength) > limit)
	)
		throw queryFailure(false);
	if (!response.body) return new Uint8Array();

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			if (signal.aborted) throw requestCancelled(signal);
			const result = await reader.read();
			if (result.done) break;
			size += result.value.byteLength;
			if (size > limit) {
				await reader.cancel();
				throw queryFailure(false);
			}
			chunks.push(result.value);
		}
	} catch (error) {
		if (error instanceof DashboardRuntimeError) throw error;
		if (signal.aborted) throw requestCancelled(signal, error);
		throw queryFailure(true, error);
	} finally {
		reader.releaseLock();
	}
	const output = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return output;
}

function queryFailure(
	retryable: boolean,
	cause?: unknown,
): DashboardRuntimeError {
	return new DashboardRuntimeError(
		"QUERY_FAILED",
		500,
		"Dashboard request failed",
		retryable,
		undefined,
		cause,
	);
}

function requestCancelled(
	signal: AbortSignal,
	cause?: unknown,
): DashboardRuntimeError {
	return new DashboardRuntimeError(
		"REQUEST_CANCELLED",
		408,
		"Dashboard request was cancelled",
		false,
		undefined,
		cause ?? signal.reason,
	);
}
