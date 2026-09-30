import { afterEach, describe, expect, it, vi } from "vitest";
import {
	fetchMe,
	fetchProtectedProfile,
	duplicatePage,
	DuplicatePageConflictError,
	HttpStatusError,
	PageContentConflictError,
	updatePageContent,
	updatePageTitle,
	movePage,
	PageParentConflictError,
	InvalidPageHierarchyError,
} from "./api";

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

const pageId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const documentValue = [{ type: "p" as const, children: [{ text: "hello" }] }];

describe("page content api", () => {
	it("puts the page id, revision, and document", async () => {
		const fetchMock = vi.fn(
			async (_input: RequestInfo | URL, _init?: RequestInit) =>
				Response.json({
					content: { revision: 1, value: documentValue },
					page: {
						id: pageId,
						updatedAt: "2026-09-30T00:00:01.000Z",
					},
				}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			updatePageContent(pageId, { revision: 0, value: documentValue }),
		).resolves.toEqual({
			content: { revision: 1, value: documentValue },
			page: {
				id: pageId,
				updatedAt: "2026-09-30T00:00:01.000Z",
			},
		});
		const [input, init] = fetchMock.mock.calls[0] ?? [];
		expect(getRequestPath(input)).toBe(`/api/pages/${pageId}/content`);
		expect((init?.method ?? "GET").toUpperCase()).toBe("PUT");
		expect(JSON.parse(String(init?.body))).toEqual({
			revision: 0,
			value: documentValue,
		});
	});

	it("keeps HTTP 409 and currentRevision without treating other statuses as conflicts", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				Response.json(
					{ message: "not used to classify the error", currentRevision: 3 },
					{ status: 409 },
				),
			),
		);
		await expect(
			updatePageContent(pageId, { revision: 1, value: documentValue }),
		).rejects.toMatchObject({
			name: "PageContentConflictError",
			status: 409,
			currentRevision: 3,
		});

		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				Response.json(
					{ message: "Content revision conflict", currentRevision: 3 },
					{ status: 500 },
				),
			),
		);
		const failure = updatePageContent(pageId, {
			revision: 1,
			value: documentValue,
		});
		await expect(failure).rejects.toBeInstanceOf(HttpStatusError);
		await expect(failure).rejects.not.toBeInstanceOf(PageContentConflictError);
		await expect(failure).rejects.toMatchObject({ status: 500 });
	});

	it("rejects a 409 that does not include an integer currentRevision", async () => {
		const input = { revision: 1, value: documentValue };
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("nope", { status: 409 })),
		);
		await expect(updatePageContent(pageId, input)).rejects.toMatchObject({
			name: "HttpStatusError",
			status: 409,
		});

		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Response.json(null, { status: 409 })),
		);
		await expect(updatePageContent(pageId, input)).rejects.toMatchObject({
			name: "HttpStatusError",
			status: 409,
		});

		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				Response.json({ currentRevision: 1.5 }, { status: 409 }),
			),
		);
		await expect(updatePageContent(pageId, input)).rejects.toMatchObject({
			name: "HttpStatusError",
			status: 409,
		});
	});
});

describe("page move api", () => {
	it("posts both parent ids and returns the accepted page response", async () => {
		const response = {
			page: {
				id: pageId,
				ownerId: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
				parentId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
				title: "Page",
				createdAt: "2026-09-30T00:00:00.000Z",
				updatedAt: "2026-09-30T00:01:00.000Z",
			},
		};
		const fetchMock = vi.fn(
			async (_input: RequestInfo | URL, _init?: RequestInit) =>
				Response.json(response),
		);
		vi.stubGlobal("fetch", fetchMock);
		await expect(
			movePage(pageId, {
				parentId: response.page.parentId,
				expectedParentId: null,
			}),
		).resolves.toEqual(response);
		const [input, init] = fetchMock.mock.calls[0] ?? [];
		expect(getRequestPath(input)).toBe(`/api/pages/${pageId}/move`);
		expect((init?.method ?? "GET").toUpperCase()).toBe("POST");
		expect(JSON.parse(String(init?.body))).toEqual({
			parentId: response.page.parentId,
			expectedParentId: null,
		});
	});

	it("classifies only validated conflict codes", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				Response.json(
					{
						message: "Page parent conflict",
						code: "PAGE_PARENT_CONFLICT",
						currentParentId: null,
					},
					{ status: 409 },
				),
			),
		);
		await expect(
			movePage(pageId, { parentId: null, expectedParentId: null }),
		).rejects.toBeInstanceOf(PageParentConflictError);
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				Response.json(
					{ message: "Invalid page hierarchy", code: "INVALID_PAGE_HIERARCHY" },
					{ status: 409 },
				),
			),
		);
		await expect(
			movePage(pageId, { parentId: null, expectedParentId: null }),
		).rejects.toBeInstanceOf(InvalidPageHierarchyError);
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Response.json({ code: "UNKNOWN" }, { status: 409 })),
		);
		await expect(
			movePage(pageId, { parentId: null, expectedParentId: null }),
		).rejects.toMatchObject({ status: 409, name: "HttpStatusError" });
	});
});

describe("page duplicate api", () => {
	const input = {
		requestId: "d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4",
		expectedContentRevision: 3,
		expectedTitle: "会議メモ",
		expectedParentId: null,
	};
	const page = {
		id: pageId,
		ownerId: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
		parentId: null,
		title: "会議メモ のコピー",
		createdAt: "2026-09-30T00:00:00.000Z",
		updatedAt: "2026-09-30T00:00:00.000Z",
	};

	it.each([
		[201, false],
		[200, true],
	] as const)("sends the saved snapshot and recognizes status %s", async (status, replayed) => {
		const fetchMock = vi.fn(
			async (_url: RequestInfo | URL, _init?: RequestInit) =>
				Response.json({ page }, { status }),
		);
		vi.stubGlobal("fetch", fetchMock);
		await expect(duplicatePage(pageId, input)).resolves.toEqual({
			page,
			replayed,
		});
		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(getRequestPath(url)).toBe(`/api/pages/${pageId}/duplicate`);
		expect((init?.method ?? "GET").toUpperCase()).toBe("POST");
		expect(JSON.parse(String(init?.body))).toEqual(input);
	});

	it("classifies a validated code instead of trusting the error message", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				Response.json(
					{ message: "arbitrary wording", code: "SOURCE_PAGE_CHANGED" },
					{ status: 409 },
				),
			),
		);
		await expect(duplicatePage(pageId, input)).rejects.toBeInstanceOf(
			DuplicatePageConflictError,
		);
		await expect(duplicatePage(pageId, input)).rejects.toMatchObject({
			status: 409,
			code: "SOURCE_PAGE_CHANGED",
		});
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				Response.json(
					{ message: "changed", code: "NOT_A_DUPLICATE_CONFLICT" },
					{ status: 409 },
				),
			),
		);
		await expect(duplicatePage(pageId, input)).rejects.toMatchObject({
			name: "HttpStatusError",
			status: 409,
		});
	});
});

describe("page title API", () => {
	it("sends PATCH through the authenticated client", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(Response.json({ page: { id: "p", title: "題" } }));
		vi.stubGlobal("fetch", fetcher);
		await expect(updatePageTitle("p", { title: "題" })).resolves.toEqual({
			page: { id: "p", title: "題" },
		});
		expect(getRequestPath(fetcher.mock.calls[0][0])).toBe("/api/pages/p");
		expect(fetcher.mock.calls[0][1]).toMatchObject({
			method: "PATCH",
			credentials: "include",
			body: JSON.stringify({ title: "題" }),
		});
	});
	it("preserves 404 status", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					Response.json({ message: "Not found" }, { status: 404 }),
				),
		);
		await expect(
			updatePageTitle("missing", { title: "題" }),
		).rejects.toMatchObject({ status: 404 });
	});
});

it("treats malformed duplicate conflict JSON as an HTTP conflict", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response("broken", { status: 409 })),
	);
	await expect(
		duplicatePage(pageId, {
			requestId: crypto.randomUUID(),
			expectedContentRevision: 0,
			expectedTitle: "source",
			expectedParentId: null,
		}),
	).rejects.toMatchObject({ status: 409, name: "HttpStatusError" });
});
