import { afterEach, describe, expect, it, vi } from "vitest";
import { appFetch, fetchMe } from "./api";

const getRequestPath = (input: RequestInfo | URL): string => {
	if (input instanceof Request) return new URL(input.url).pathname;
	return new URL(input.toString(), "http://localhost").pathname;
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("auth api", () => {
	it("treats /auth/me 401 as a logged-out session without refreshing", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL) => {
			return new Response(JSON.stringify({ message: "Unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(fetchMe()).resolves.toBeNull();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls.map(([input]) => getRequestPath(input))).toEqual([
			"/api/auth/me",
		]);
	});

	it("preserves Request headers and its abort signal", async () => {
		const controller = new AbortController();
		let resolveRefresh: ((response: Response) => void) | undefined;
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const path = getRequestPath(input);
			if (path === "/api/auth/refresh")
				return new Promise<Response>((resolve) => {
					resolveRefresh = resolve;
				});
			const request = input instanceof Request ? input : new Request(input);
			expect(request.headers.get("X-Test-Header")).toBe("kept");
			return new Response(null, { status: 401 });
		});
		vi.stubGlobal("fetch", fetchMock);

		const pending = appFetch(
			new Request("http://localhost/api/protected/profile", {
				headers: { "X-Test-Header": "kept" },
				signal: controller.signal,
			}),
		);
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		controller.abort();

		await expect(pending).rejects.toMatchObject({ name: "AbortError" });
		resolveRefresh?.(new Response(null, { status: 204 }));
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
