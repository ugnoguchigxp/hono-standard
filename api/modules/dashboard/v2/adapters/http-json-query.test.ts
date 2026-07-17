import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
	type DashboardFetch,
	defineHttpJsonRecordQueryV2,
	MAX_DASHBOARD_HTTP_RESPONSE_BYTES,
} from "./http-json-query";
import { dashboardRecordQueryTestContext } from "./test-helpers";

const responseSchema = z.object({
	items: z.array(z.object({ id: z.string(), value: z.number() })),
});

const createQuery = (options: {
	fetch: DashboardFetch;
	baseUrl?: string;
	maxResponseBytes?: number;
	request?: () => {
		path: string;
		method?: "GET" | "POST";
		search?: Record<string, string | string[] | undefined>;
		headers?: Record<string, string>;
		body?: null | boolean | number | string | object;
	};
}) =>
	defineHttpJsonRecordQueryV2({
		id: "remote-items",
		filterKeys: [],
		baseUrl: options.baseUrl ?? "https://api.example.test",
		frameName: "Remote items",
		columns: [
			{ source: "id", type: "string" },
			{ source: "value", type: "number" },
		],
		responseSchema,
		request: options.request ?? (() => ({ path: "/items" })),
		selectRecords: (response) => response.items,
		maxResponseBytes: options.maxResponseBytes,
		fetch: options.fetch,
	});

describe("defineHttpJsonRecordQueryV2", () => {
	it("uses a fixed origin, deterministic search, safe headers, and AbortSignal", async () => {
		const fetchMock = vi.fn<DashboardFetch>(async (_input, _init) =>
			new Response(JSON.stringify({ items: [{ id: "one", value: 1 }] }), {
				headers: { "content-type": "application/json; charset=utf-8" },
			}),
		);
		const query = createQuery({
			fetch: fetchMock,
			request: () => ({
				path: "/items",
				search: { z: "last", a: ["one", "two"] },
				headers: { Authorization: "Bearer secret" },
			}),
		});
		const context = dashboardRecordQueryTestContext();
		const result = await query.handler(context);
		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(String(url)).toBe(
			"https://api.example.test/items?a=one&a=two&z=last",
		);
		expect(init).toMatchObject({ method: "GET", redirect: "error", signal: context.signal });
		const headers = new Headers(init?.headers);
		expect(headers.get("accept")).toBe("application/json");
		expect(headers.get("authorization")).toBe("Bearer secret");
		expect(result.frames[0]?.fields.map((field) => field.values)).toEqual([
			["one"],
			[1],
		]);
		expect(JSON.stringify(result)).not.toContain("secret");
	});

	it("serializes validated POST JSON", async () => {
		const fetchMock = vi.fn<DashboardFetch>(async () =>
			new Response(JSON.stringify({ items: [] }), {
				headers: { "content-type": "application/problem+json" },
			}),
		);
		const query = createQuery({
			fetch: fetchMock,
			request: () => ({
				path: "/items",
				method: "POST",
				body: { status: "failed" },
			}),
		});
		await query.handler(dashboardRecordQueryTestContext());
		const init = fetchMock.mock.calls[0]?.[1];
		expect(init?.body).toBe('{"status":"failed"}');
		expect(new Headers(init?.headers).get("content-type")).toBe(
			"application/json",
		);
	});

	it.each([
		"ftp://api.example.test",
		"https://user:pass@api.example.test",
		"https://api.example.test/path",
		"https://api.example.test?token=secret",
		"https://api.example.test#fragment",
	])("rejects an unsafe base URL: %s", (baseUrl) => {
		expect(() =>
			createQuery({ fetch: vi.fn<DashboardFetch>(), baseUrl }),
		).toThrow(TypeError);
	});

	it.each([
		() => ({ path: "https://evil.example/items" }),
		() => ({ path: "//evil.example/items" }),
		() => ({ path: "/items", method: "GET" as const, body: { value: 1 } }),
		() => ({ path: "/items", headers: { Cookie: "session=secret" } }),
		() => ({ path: "/items", headers: { Host: "evil.example" } }),
	])("rejects an unsafe request", async (request) => {
		const query = createQuery({ fetch: vi.fn<DashboardFetch>(), request });
		await expect(
			query.handler(dashboardRecordQueryTestContext()),
		).rejects.toMatchObject({ code: "QUERY_FAILED", retryable: false });
	});

	it.each([
		[
			new Response("not json", { headers: { "content-type": "text/plain" } }),
			false,
		],
		[
			new Response("not json", {
				headers: { "content-type": "application/json" },
			}),
			false,
		],
		[
			new Response(JSON.stringify({ wrong: [] }), {
				headers: { "content-type": "application/json" },
			}),
			false,
		],
		[new Response("busy", { status: 429 }), true],
		[new Response("failed", { status: 503 }), true],
		[new Response("missing", { status: 404 }), false],
	] as const)("maps response failures without leaking response data %#", async (response, retryable) => {
		const query = createQuery({
			fetch: vi.fn<DashboardFetch>(async () => response.clone()),
		});
		const error = await Promise.resolve(
			query.handler(dashboardRecordQueryTestContext()),
		).catch((caught: unknown) => caught);
		expect(error).toMatchObject({ code: "QUERY_FAILED", retryable });
		expect(String(error)).not.toContain("not json");
	});

	it("rejects declared and streamed responses over the byte limit", async () => {
		const declared = createQuery({
			fetch: vi.fn<DashboardFetch>(async () =>
				new Response("{}", {
					headers: {
					"content-type": "application/json",
					"content-length": "100",
				},
				}),
			),
			maxResponseBytes: 10,
		});
		await expect(
			declared.handler(dashboardRecordQueryTestContext()),
		).rejects.toMatchObject({ code: "QUERY_FAILED", retryable: false });

		const streamed = createQuery({
			fetch: vi.fn<DashboardFetch>(async () =>
				new Response(JSON.stringify({ items: [{ id: "long-value", value: 1 }] }), {
					headers: { "content-type": "application/json" },
				}),
			),
			maxResponseBytes: 10,
		});
		await expect(
			streamed.handler(dashboardRecordQueryTestContext()),
		).rejects.toMatchObject({ code: "QUERY_FAILED", retryable: false });
	});

	it("forwards abort and rejects an invalid configured byte budget", async () => {
		const controller = new AbortController();
		controller.abort("cancelled");
		const query = createQuery({ fetch: vi.fn<DashboardFetch>() });
		await expect(
			query.handler(
				dashboardRecordQueryTestContext({ signal: controller.signal }),
			),
		).rejects.toMatchObject({ code: "REQUEST_CANCELLED" });
		expect(() =>
			createQuery({
				fetch: vi.fn<DashboardFetch>(),
				maxResponseBytes: MAX_DASHBOARD_HTTP_RESPONSE_BYTES + 1,
			}),
		).toThrow(TypeError);
	});
});
