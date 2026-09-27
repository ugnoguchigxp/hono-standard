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
	it("refreshes an expired /auth/me session and retries once", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			if (getRequestPath(input) === "/api/auth/refresh") {
				return new Response(null, { status: 204 });
			}
			if (fetchMock.mock.calls.length === 1) {
				return new Response(null, { status: 401 });
			}
			return Response.json({ user: { id: "user-1", email: "test@example.com" } });
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(fetchMe()).resolves.toMatchObject({ id: "user-1" });

		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(fetchMock.mock.calls.map(([input]) => getRequestPath(input))).toEqual([
			"/api/auth/me",
			"/api/auth/refresh",
			"/api/auth/me",
		]);
	});

	it("returns a logged-out session when /auth/me refresh fails", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
			new Response(null, { status: 401 }),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(fetchMe()).resolves.toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls.map(([input]) => getRequestPath(input))).toEqual([
			"/api/auth/me",
			"/api/auth/refresh",
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
