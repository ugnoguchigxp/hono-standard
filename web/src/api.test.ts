import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMe, fetchProtectedProfile } from "./api";

const getRequestPath = (input: RequestInfo | URL): string => {
	if (input instanceof Request) return new URL(input.url).pathname;
	return new URL(input.toString(), "http://localhost").pathname;
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("auth api", () => {
	it("refreshes an expired access token before retrying /auth/me", async () => {
		const user = {
			id: "a1a1a1a1-a1a1-41a1-a1a1-a1a1a1a1a1a1",
			email: "test@example.com",
			displayName: "Test User",
			role: "member",
		};
		let meRequests = 0;
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const path = getRequestPath(input);
			if (path === "/api/auth/refresh") return new Response(null, { status: 200 });
			meRequests += 1;
			return meRequests === 1
				? new Response(JSON.stringify({ message: "Unauthorized" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					})
				: Response.json({ user });
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(fetchMe()).resolves.toEqual(user);

		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(fetchMock.mock.calls.map(([input]) => getRequestPath(input))).toEqual([
			"/api/auth/me",
			"/api/auth/refresh",
			"/api/auth/me",
		]);
	});

	it("treats /auth/me as logged out when the refresh token is unavailable", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const path = getRequestPath(input);
			return new Response(JSON.stringify({ message: "Unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json", "X-Path": path },
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(fetchMe()).resolves.toBeNull();
		expect(fetchMock.mock.calls.map(([input]) => getRequestPath(input))).toEqual([
			"/api/auth/me",
			"/api/auth/refresh",
		]);
	});

	it("shares one refresh request across concurrent expired requests", async () => {
		let protectedRequests = 0;
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const path = getRequestPath(input);
			if (path === "/api/auth/refresh") return new Response(null, { status: 200 });
			protectedRequests += 1;
			if (protectedRequests <= 2) {
				return new Response(JSON.stringify({ message: "Unauthorized" }), {
					status: 401,
					headers: { "Content-Type": "application/json" },
				});
			}
			return Response.json({
				profile: { email: "test@example.com", role: "member" },
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			Promise.all([fetchProtectedProfile(), fetchProtectedProfile()]),
		).resolves.toEqual([
			{ email: "test@example.com", role: "member" },
			{ email: "test@example.com", role: "member" },
		]);
		expect(
			fetchMock.mock.calls.filter(
				([input]) => getRequestPath(input) === "/api/auth/refresh",
			),
		).toHaveLength(1);
	});
});
