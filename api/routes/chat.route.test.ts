import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { AuthContextUser } from "../modules/auth/context";
import { createChatRoute } from "./chat.route";

const userId = "a1a1a1a1-a1a1-41a1-a1a1-a1a1a1a1a1a1";
const conversationId = "c3c3c3c3-c3c3-43c3-b3c3-c3c3c3c3c3c3";
const authUser: AuthContextUser = {
	userId,
	email: "member@example.com",
	role: "member",
};

function queryChain(rows: unknown[]) {
	const chain: Record<string, unknown> = {};
	for (const method of ["from", "where", "orderBy"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.limit = vi.fn().mockResolvedValue(rows);
	chain.then = (
		resolve: (value: unknown[]) => unknown,
		reject: (reason: unknown) => unknown,
	) => Promise.resolve(rows).then(resolve, reject);
	return chain;
}

function createDb(options: {
	selectResults: unknown[][];
	conversationResults: Array<object | null>;
}) {
	const selectResults = [...options.selectResults];
	const conversationResults = [...options.conversationResults];
	const deleteWhere = vi.fn().mockResolvedValue(undefined);
	return {
		select: vi.fn(() => queryChain(selectResults.shift() ?? [])),
		query: {
			conversations: {
				findFirst: vi.fn(() =>
					Promise.resolve(conversationResults.shift() ?? null),
				),
			},
		},
		delete: vi.fn(() => ({ where: deleteWhere })),
		deleteWhere,
	};
}

function createApp(
	db: ReturnType<typeof createDb>,
	chatService: { run: ReturnType<typeof vi.fn> },
) {
	return new Hono()
		.use("*", async (c, next) => {
			c.set("authUser", authUser);
			await next();
		})
		.route(
			"/",
			createChatRoute({
				db: db as never,
				llmProvider: {} as never,
				evidenceCollector: {} as never,
				chatService: chatService as never,
			}),
		);
}

const chatBody = {
	messages: [{ role: "user", content: "How does RAG work?" }],
	conversationId,
	topK: 3,
	category: "tech",
};

const jsonRequest = (body: unknown): RequestInit => ({
	method: "POST",
	headers: { "content-type": "application/json" },
	body: JSON.stringify(body),
});

describe("chat route", () => {
	it("lists conversations, messages, artifacts and retrieval logs", async () => {
		const now = new Date("2026-01-01T00:00:00.000Z");
		const db = createDb({
			selectResults: [
				[{ id: conversationId, title: "Chat", createdAt: now, updatedAt: now }],
				[
					{ id: "message-1", role: "assistant", content: "A", createdAt: now },
					{ id: "message-2", role: "user", content: "Q", createdAt: now },
				],
				[
					{ id: "artifact-1", messageId: "message-1", type: "markdown" },
					{ id: "artifact-2", messageId: "message-1", type: "json" },
				],
				[{ id: "log-1", query: "RAG", createdAt: now }],
			],
			conversationResults: [{ id: conversationId }, { id: conversationId }],
		});
		const app = createApp(db, {
			run: vi.fn(),
		});

		const conversations = await app.request("/conversations?limit=5");
		expect(conversations.status).toBe(200);
		expect(await conversations.json()).toMatchObject({
			items: [{ id: conversationId, title: "Chat" }],
		});

		const messages = await app.request(
			`/conversations/${conversationId}/messages`,
		);
		expect(messages.status).toBe(200);
		expect(await messages.json()).toMatchObject({
			conversationId,
			items: [
				{
					id: "message-1",
					artifacts: [{ id: "artifact-1" }, { id: "artifact-2" }],
				},
				{ id: "message-2", artifacts: [] },
			],
		});

		const logs = await app.request(
			`/conversations/${conversationId}/retrieval-logs?limit=4`,
		);
		expect(logs.status).toBe(200);
		expect(await logs.json()).toMatchObject({ items: [{ id: "log-1" }] });
	});

	it("returns 404 for inaccessible conversation resources", async () => {
		const db = createDb({
			selectResults: [],
			conversationResults: [null, null, null],
		});
		const app = createApp(db, { run: vi.fn() });

		expect(
			(await app.request(`/conversations/${conversationId}/messages`)).status,
		).toBe(404);
		expect(
			(await app.request(`/conversations/${conversationId}/retrieval-logs`))
				.status,
		).toBe(404);
		expect(
			(
				await app.request(`/conversations/${conversationId}`, {
					method: "DELETE",
				})
			).status,
		).toBe(404);
	});

	it("deletes an owned conversation and executes regular chat", async () => {
		const db = createDb({
			selectResults: [],
			conversationResults: [{ id: conversationId }],
		});
		const result = {
			id: "message-1",
			conversationId,
			text: "Answer",
			citations: [],
			retrieved: [],
			artifacts: [],
		};
		const run = vi.fn().mockResolvedValue(result);
		const app = createApp(db, { run });

		const deleted = await app.request(`/conversations/${conversationId}`, {
			method: "DELETE",
		});
		expect(deleted.status).toBe(200);
		expect(db.deleteWhere).toHaveBeenCalled();

		const response = await app.request("/", jsonRequest(chatBody));
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject(result);
		expect(run).toHaveBeenCalledWith({
			messages: chatBody.messages,
			userId,
			conversationId,
			topK: 3,
			category: "tech",
		});
	});

	it("streams successful results including artifacts", async () => {
		const result = {
			id: "message-1",
			conversationId,
			text: "Answer",
			citations: [{ kind: "wiki_fragment" }],
			retrieved: [{ id: "fragment-1" }],
			artifacts: [{ id: "artifact-1", type: "markdown", content: "Body" }],
			usage: { totalTokens: 10 },
		};
		const app = createApp(
			createDb({ selectResults: [], conversationResults: [] }),
			{ run: vi.fn().mockResolvedValue(result) },
		);

		const response = await app.request("/stream", jsonRequest(chatBody));
		const body = await response.text();
		expect(response.status).toBe(200);
		expect(body).toContain("event: message_start");
		expect(body).toContain("event: retrieval_result");
		expect(body).toContain("event: text_delta");
		expect(body).toContain("event: artifact_complete");
		expect(body).toContain("event: message_complete");
		expect(body).toContain('"delta":"Answer"');
	});

	it.each([
		[new Error("stream failed"), "stream failed"],
		["unknown failure", "Stream chat failed"],
	])("streams a stable error event for %p", async (reason, message) => {
		const app = createApp(
			createDb({ selectResults: [], conversationResults: [] }),
			{ run: vi.fn().mockRejectedValue(reason) },
		);

		const response = await app.request(
			"/stream",
			jsonRequest({
				messages: [{ role: "user", content: "Question" }],
			}),
		);
		expect(await response.text()).toContain(`"message":"${message}"`);
	});
});
