import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMe, fetchProtectedProfile } from "./api";

const getRequestPath = (input: RequestInfo | URL): string => {
	if (input instanceof Request) return new URL(input.url).pathname;
	return new URL(input.toString(), "http://localhost").pathname;
};

const user = {
	id: "user-id",
	email: "user@example.com",
	displayName: "User",
	role: "member",
};
const unauthorized = () =>
	Response.json({ message: "Unauthorized" }, { status: 401 });

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("auth api", () => {
	it("returns a logged-out session only after refresh is rejected", async () => {
		const fetchMock = vi.fn(async () => unauthorized());
		vi.stubGlobal("fetch", fetchMock);
		await expect(fetchMe()).resolves.toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("restores /auth/me after the access cookie expires", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(unauthorized())
			.mockResolvedValueOnce(Response.json({ user }))
			.mockResolvedValueOnce(Response.json({ user }));
		vi.stubGlobal("fetch", fetchMock);
		await expect(fetchMe()).resolves.toEqual(user);
		expect(
			fetchMock.mock.calls.map(([input]) => getRequestPath(input)),
		).toEqual(["/api/auth/me", "/api/auth/refresh", "/api/auth/me"]);
	});

	it("shares a rotation between concurrent requests", async () => {
		let refreshed = false;
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			if (getRequestPath(input) === "/api/auth/refresh") {
				await new Promise((resolve) => setTimeout(resolve, 10));
				refreshed = true;
				return Response.json({ user });
			}
			return refreshed
				? Response.json({ user, profile: user })
				: unauthorized();
		});
		vi.stubGlobal("fetch", fetchMock);
		await expect(
			Promise.all([fetchMe(), fetchProtectedProfile()]),
		).resolves.toEqual([user, user]);
		expect(
			fetchMock.mock.calls.filter(
				([input]) => getRequestPath(input) === "/api/auth/refresh",
			),
		).toHaveLength(1);
	});

	it("retries a late 401 without rotating a second time", async () => {
		let releaseLateResponse: (response: Response) => void = () => {};
		const late = new Promise<Response>((resolve) => {
			releaseLateResponse = resolve;
		});
		let profileRequests = 0;
		let meRequests = 0;
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const path = getRequestPath(input);
			if (path === "/api/protected/profile")
				return ++profileRequests === 1
					? late
					: Response.json({ profile: user });
			if (path === "/api/auth/refresh") return Response.json({ user });
			return ++meRequests === 1 ? unauthorized() : Response.json({ user });
		});
		vi.stubGlobal("fetch", fetchMock);
		const profile = fetchProtectedProfile();
		await expect(fetchMe()).resolves.toEqual(user);
		releaseLateResponse(unauthorized());
		await expect(profile).resolves.toEqual(user);
		expect(
			fetchMock.mock.calls.filter(
				([input]) => getRequestPath(input) === "/api/auth/refresh",
			),
		).toHaveLength(1);
	});

	it("propagates refresh network failure and permits a subsequent attempt", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(unauthorized())
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce(unauthorized())
			.mockResolvedValueOnce(Response.json({ user }))
			.mockResolvedValueOnce(Response.json({ user }));
		vi.stubGlobal("fetch", fetchMock);
		await expect(fetchMe()).rejects.toThrow("offline");
		await expect(fetchMe()).resolves.toEqual(user);
	});

	it("does not loop when the retried session request is still unauthorized", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(unauthorized())
			.mockResolvedValueOnce(Response.json({ user }))
			.mockResolvedValueOnce(unauthorized());
		vi.stubGlobal("fetch", fetchMock);
		await expect(fetchMe()).resolves.toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});
});
