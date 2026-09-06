import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson, fetchWithTimeout, HttpError } from "./httpClient";

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("HTTP client", () => {
	it("adds query parameters and composes JSON headers", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ ok: true }), {
				headers: { "content-type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		expect(
			await fetchJson<{ ok: boolean }>("https://example.com/api", {
				params: { q: "rag", limit: 3 },
				headers: { Authorization: "Bearer token" },
			}),
		).toEqual({ ok: true });
		expect(fetchMock).toHaveBeenCalledWith(
			"https://example.com/api?q=rag&limit=3",
			expect.objectContaining({
				headers: {
					Accept: "application/json",
					Authorization: "Bearer token",
				},
				signal: expect.any(AbortSignal),
			}),
		);
	});

	it("throws a detailed HttpError for non-success responses", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					new Response("bad", { status: 418, statusText: "Teapot" }),
				),
		);

		const error = await fetchWithTimeout("https://example.com").catch(
			(caught) => caught,
		);
		expect(error).toBeInstanceOf(HttpError);
		expect(error).toMatchObject({
			message: "HTTP error: 418 Teapot",
			status: 418,
			statusText: "Teapot",
			name: "HttpError",
		});
	});

	it("turns aborts into timeout errors and preserves other failures", async () => {
		vi.useFakeTimers();
		vi.stubGlobal(
			"fetch",
			vi.fn(
				(_url: string, init: RequestInit) =>
					new Promise((_resolve, reject) => {
						init.signal?.addEventListener("abort", () => {
							const error = new Error("aborted");
							error.name = "AbortError";
							reject(error);
						});
					}),
			),
		);

		const pending = fetchWithTimeout("https://example.com", { timeout: 20 });
		const timeoutExpectation = expect(pending).rejects.toThrow(
			"Request timeout after 20ms",
		);
		await vi.advanceTimersByTimeAsync(20);
		await timeoutExpectation;

		vi.useRealTimers();
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
		await expect(fetchWithTimeout("https://example.com")).rejects.toThrow(
			"network",
		);
	});
});
