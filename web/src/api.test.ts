import { afterEach, describe, expect, it, vi } from "vitest";
import {
	agenticSearch,
	createAdminUser,
	createSourceFolder,
	createSourcePage,
	deleteConversation,
	deleteSourceFolder,
	deleteSourcePage,
	disableAdminUser,
	enableAdminUser,
	fetchAdminUsers,
	fetchConversationMessages,
	fetchConversations,
	fetchMe,
	fetchRetrievalLogs,
	fetchSourceCategories,
	fetchSourceDiff,
	fetchSourceHealth,
	fetchSourceHistory,
	fetchSourcePage,
	fetchSourceTree,
	fetchSystemContext,
	login,
	logout,
	renameSourceFolder,
	resetAdminUserPassword,
	runSourceReindex,
	searchFragments,
	searchSourcePages,
	sendChat,
	UNAUTHORIZED_EVENT_NAME,
	updateAdminUser,
	updateSourcePage,
	updateSystemContext,
} from "./api";

const user = {
	id: "a1a1a1a1-a1a1-41a1-a1a1-a1a1a1a1a1a1",
	email: "test@example.com",
	displayName: "Test User",
	role: "member" as const,
};

const getRequestPath = (input: RequestInfo | URL): string =>
	new URL(input.toString(), "http://localhost").pathname;

const getRequestUrl = (input: RequestInfo | URL): URL =>
	new URL(input.toString(), "http://localhost");

const jsonFetch = (payload: unknown, status = 200) =>
	vi.fn(
		async (_input: RequestInfo | URL, _init?: RequestInit) =>
			Response.json(payload, { status }),
	);

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("RAG web API", () => {
	it("reads source, settings, and search resources", async () => {
		const tree = {
			items: [{ slug: "guide", title: "Guide", path: "guide.md", updatedAt: "" }],
			folders: [{ path: "docs" }],
		};
		let fetchMock = jsonFetch(tree);
		vi.stubGlobal("fetch", fetchMock);
		await expect(fetchSourceTree()).resolves.toEqual(tree);
		expect(getRequestPath(fetchMock.mock.calls[0]![0])).toBe("/api/sources/tree");

		fetchMock = jsonFetch({ items: ["guide", "reference"] });
		vi.stubGlobal("fetch", fetchMock);
		await expect(fetchSourceCategories()).resolves.toEqual([
			"guide",
			"reference",
		]);

		const health = { service: "rag", git: null };
		fetchMock = jsonFetch(health);
		vi.stubGlobal("fetch", fetchMock);
		await expect(fetchSourceHealth()).resolves.toEqual(health);

		const context = {
			systemContext: "Use concise answers.",
			instructionLocale: "en-US" as const,
			updatedAt: "",
		};
		fetchMock = jsonFetch(context);
		vi.stubGlobal("fetch", fetchMock);
		await expect(fetchSystemContext()).resolves.toEqual(context);

		fetchMock = jsonFetch(context);
		vi.stubGlobal("fetch", fetchMock);
		await expect(
			updateSystemContext(context.systemContext, context.instructionLocale),
		).resolves.toEqual(context);
		expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: "PUT" });
		expect(JSON.parse(fetchMock.mock.calls[0]![1]?.body as string)).toEqual({
			systemContext: context.systemContext,
			instructionLocale: context.instructionLocale,
		});

		fetchMock = jsonFetch({ items: [{ slug: "guide", excerpt: "hello" }] });
		vi.stubGlobal("fetch", fetchMock);
		await expect(searchSourcePages("hello world")).resolves.toEqual([
			{ slug: "guide", excerpt: "hello" },
		]);
		expect(getRequestUrl(fetchMock.mock.calls[0]![0]).search).toBe(
			"?q=hello+world",
		);
	});

	it("manages pages, folders, history, and reindexing", async () => {
		const mutation = { ok: true as const, commit: "abc123" };
		const page = {
			slug: "guide/setup",
			title: "Setup",
			body: "body",
			path: "guide/setup.md",
			meta: {},
		};
		let fetchMock = jsonFetch(page);
		vi.stubGlobal("fetch", fetchMock);
		await expect(fetchSourcePage("guide/setup")).resolves.toEqual(page);
		expect(getRequestPath(fetchMock.mock.calls[0]![0])).toBe(
			"/api/sources/pages/guide/setup",
		);

		fetchMock = jsonFetch(mutation);
		vi.stubGlobal("fetch", fetchMock);
		await expect(
			updateSourcePage("guide/setup", {
				slug: "guide/install",
				title: "Install",
				body: "updated",
				meta: { order: 1 },
				commitMessage: "Update guide",
			}),
		).resolves.toEqual(mutation);
		expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: "PUT" });

		fetchMock = jsonFetch(mutation);
		vi.stubGlobal("fetch", fetchMock);
		await expect(
			createSourcePage({
				slug: "guide/new",
				title: "New",
				body: "body",
				meta: {},
			}),
		).resolves.toEqual(mutation);

		for (const operation of [
			() => deleteSourcePage("guide/new"),
			() => createSourceFolder("guide/deep"),
			() => renameSourceFolder("guide/deep", "guide/nested"),
			() => deleteSourceFolder("guide/nested"),
		]) {
			fetchMock = jsonFetch(mutation);
			vi.stubGlobal("fetch", fetchMock);
			await expect(operation()).resolves.toEqual(mutation);
		}

		const reindex = {
			ok: true as const,
			importedFiles: 3,
			skippedFiles: 1,
			removedSources: 0,
		};
		fetchMock = jsonFetch(reindex);
		vi.stubGlobal("fetch", fetchMock);
		await expect(runSourceReindex()).resolves.toEqual(reindex);

		const history = [
			{ commit: "abc", author: "Codex", date: "", message: "Update" },
		];
		fetchMock = jsonFetch({ items: history });
		vi.stubGlobal("fetch", fetchMock);
		await expect(fetchSourceHistory("guide/setup")).resolves.toEqual(history);

		fetchMock = jsonFetch({ diff: "-old\\n+new" });
		vi.stubGlobal("fetch", fetchMock);
		await expect(fetchSourceDiff("guide/setup", "abc", "def")).resolves.toBe(
			"-old\\n+new",
		);
		expect(getRequestUrl(fetchMock.mock.calls[0]![0]).search).toBe(
			"?from=abc&to=def",
		);
	});

	it("reads and mutates conversations and search results", async () => {
		const conversation = {
			id: "conversation-1",
			title: null,
			metadata: {},
			createdAt: "",
			updatedAt: "",
		};
		let fetchMock = jsonFetch({ items: [conversation] });
		vi.stubGlobal("fetch", fetchMock);
		await expect(fetchConversations()).resolves.toEqual([conversation]);
		expect(getRequestUrl(fetchMock.mock.calls[0]![0]).search).toBe("?limit=50");

		fetchMock = jsonFetch({ ok: true });
		vi.stubGlobal("fetch", fetchMock);
		await expect(deleteConversation(conversation.id)).resolves.toEqual({
			ok: true,
		});

		const message = {
			id: "message-1",
			role: "user" as const,
			content: "hello",
			metadata: {},
			createdAt: "",
			artifacts: [],
		};
		fetchMock = jsonFetch({ items: [message] });
		vi.stubGlobal("fetch", fetchMock);
		await expect(fetchConversationMessages(conversation.id)).resolves.toEqual([
			message,
		]);

		const log = {
			id: "log-1",
			messageId: null,
			query: "hello",
			fragmentIds: [],
			scores: {},
			context: {},
			createdAt: "",
		};
		fetchMock = jsonFetch({ items: [log] });
		vi.stubGlobal("fetch", fetchMock);
		await expect(fetchRetrievalLogs(conversation.id, 5)).resolves.toEqual([log]);
		expect(getRequestUrl(fetchMock.mock.calls[0]![0]).search).toBe("?limit=5");

		const chat = {
			id: "chat-1",
			conversationId: conversation.id,
			text: "answer",
			citations: [],
			artifacts: [],
			retrieved: [],
		};
		fetchMock = jsonFetch(chat);
		vi.stubGlobal("fetch", fetchMock);
		await expect(
			sendChat({ messages: [{ role: "user", content: "hello" }] }),
		).resolves.toEqual(chat);

		const search = {
			query: "hello",
			topK: 5,
			category: null,
			strategy: "text_fallback" as const,
			vectorResults: [],
			textResults: [],
			webResults: [],
			webSearch: {
				available: false,
				provider: null,
				message: null,
				unavailableMessage: null,
			},
			mergedResults: [],
			selectedResults: [],
		};
		fetchMock = jsonFetch(search);
		vi.stubGlobal("fetch", fetchMock);
		await expect(searchFragments({ query: "hello" })).resolves.toEqual(search);

		const agentic = {
			query: "hello",
			answer: "answer",
			citations: [],
			toolTrace: [],
		};
		fetchMock = jsonFetch(agentic);
		vi.stubGlobal("fetch", fetchMock);
		await expect(agenticSearch({ query: "hello" })).resolves.toEqual(agentic);
	});

	it("manages authentication and admin users", async () => {
		let fetchMock = jsonFetch({ user });
		vi.stubGlobal("fetch", fetchMock);
		await expect(
			login({ email: user.email, password: "password123456" }),
		).resolves.toEqual({ user });

		fetchMock = jsonFetch({ user });
		vi.stubGlobal("fetch", fetchMock);
		await expect(fetchMe()).resolves.toEqual(user);

		fetchMock = jsonFetch({ items: [user] });
		vi.stubGlobal("fetch", fetchMock);
		await expect(fetchAdminUsers()).resolves.toEqual([user]);

		for (const operation of [
			() =>
				createAdminUser({
					email: "new@example.com",
					displayName: "New User",
					role: "member",
					initialPassword: "password123456",
				}),
			() => updateAdminUser(user.id, { displayName: "Updated User" }),
			() => disableAdminUser(user.id),
			() => enableAdminUser(user.id),
		]) {
			fetchMock = jsonFetch({ user });
			vi.stubGlobal("fetch", fetchMock);
			await expect(operation()).resolves.toEqual(user);
		}

		fetchMock = jsonFetch({ ok: true });
		vi.stubGlobal("fetch", fetchMock);
		await expect(
			resetAdminUserPassword(user.id, "new-password123456"),
		).resolves.toBeUndefined();

		fetchMock = jsonFetch({ ok: true });
		vi.stubGlobal("fetch", fetchMock);
		await expect(logout()).resolves.toBeUndefined();
	});

	it("refreshes and retries JSON and void requests", async () => {
		let treeRequests = 0;
		let fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const path = getRequestPath(input);
			if (path === "/api/auth/refresh") {
				return new Response(null, { status: 204 });
			}
			treeRequests += 1;
			return treeRequests === 1
				? Response.json({ message: "Unauthorized" }, { status: 401 })
				: Response.json({ items: [], folders: [] });
		});
		vi.stubGlobal("fetch", fetchMock);
		await expect(fetchSourceTree()).resolves.toEqual({ items: [], folders: [] });

		let resetRequests = 0;
		fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const path = getRequestPath(input);
			if (path === "/api/auth/refresh") {
				return new Response(null, { status: 204 });
			}
			resetRequests += 1;
			return resetRequests === 1
				? Response.json({ message: "Unauthorized" }, { status: 401 })
				: new Response(null, { status: 204 });
		});
		vi.stubGlobal("fetch", fetchMock);
		await expect(
			resetAdminUserPassword(user.id, "new-password123456"),
		).resolves.toBeUndefined();
	});

	it("reports JSON and non-JSON failures without refreshing login", async () => {
		let fetchMock = jsonFetch({ message: "Invalid credentials" }, 401);
		vi.stubGlobal("fetch", fetchMock);
		await expect(
			login({ email: user.email, password: "invalid" }),
		).rejects.toThrow("Invalid credentials");
		expect(fetchMock).toHaveBeenCalledTimes(1);

		fetchMock = vi.fn(
			async (_input: RequestInfo | URL, _init?: RequestInit) =>
				new Response("unavailable", { status: 503 }),
		);
		vi.stubGlobal("fetch", fetchMock);
		await expect(logout()).rejects.toThrow("Request failed: 503");
	});

	it("notifies the browser once when session refresh fails", async () => {
		const dispatchEvent = vi.fn();
		vi.stubGlobal("window", { dispatchEvent });
		vi.spyOn(Date, "now").mockReturnValue(10_000);
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) =>
				getRequestPath(input) === "/api/auth/refresh"
					? new Response(null, { status: 401 })
					: Response.json({ message: "Unauthorized" }, { status: 401 }),
			),
		);

		await expect(fetchMe()).rejects.toThrow("Unauthorized");
		await expect(fetchMe()).rejects.toThrow("Unauthorized");
		expect(dispatchEvent).toHaveBeenCalledTimes(1);
		expect(dispatchEvent.mock.calls[0]?.[0]).toMatchObject({
			type: UNAUTHORIZED_EVENT_NAME,
		});
	});
});
