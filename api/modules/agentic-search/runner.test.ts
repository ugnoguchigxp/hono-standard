import { describe, expect, it, vi } from "vitest";
import type { OpenAiResponsesAdapter } from "./llm/openai-responses-adapter";
import { AgenticSearchRunner } from "./runner";
import type { AgenticFunctionToolSpec } from "./types";
import type { AgenticToolRegistry } from "./tools/registry";

type StubTurn = {
	responseId: string;
	text: string;
	functionCalls: Array<{ callId: string; name: string; argumentsJson: string }>;
	usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
};

class StubAdapter {
	public readonly calls: Array<{
		instructions: string;
		input: unknown[];
		previousResponseId?: string;
		tools: AgenticFunctionToolSpec[];
	}> = [];
	private index = 0;

	constructor(private readonly turns: StubTurn[]) {}

	async createTurn(params: {
		instructions: string;
		input: unknown[];
		tools: AgenticFunctionToolSpec[];
		previousResponseId?: string;
	}) {
		this.calls.push(params);
		const turn = this.turns[this.index];
		this.index += 1;
		if (!turn) {
			throw new Error("No stub turn prepared");
		}
		return turn;
	}
}

function createRegistryStub() {
	return {
		listSpecs: () =>
			[
				{
					type: "function" as const,
					name: "search_evidence",
					description: "search",
					parameters: { type: "object", properties: {} },
				},
			] satisfies AgenticFunctionToolSpec[],
		has: (name: string) => name === "search_evidence" || name === "fetch",
		execute: async (name: string) => {
			if (name === "search_evidence") {
				return {
					output: {
						hits: [{ id: "a" }],
					},
					resultCount: 1,
					citations: [
						{
							kind: "wiki_fragment" as const,
							title: "Doc A",
							uri: "wiki://a",
							locator: "chunk:0001",
							wikiSlug: "tech/a",
						},
						{
							kind: "wiki_fragment" as const,
							title: "Doc A",
							uri: "wiki://a",
							locator: "chunk:0002",
							wikiSlug: "tech/a",
						},
						{
							kind: "wiki_page" as const,
							title: "Doc A",
							uri: "wiki://a",
							wikiSlug: "tech/a",
						},
					],
				};
			}
			return {
				output: { fetched: true },
				resultCount: 1,
			};
		},
	};
}

describe("AgenticSearchRunner", () => {
	it("returns final text when no tool calls are requested", async () => {
		const adapter = new StubAdapter([
			{
				responseId: "resp_1",
				text: "final answer",
				functionCalls: [],
				usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
			},
		]);
		const runner = new AgenticSearchRunner({
			llmAdapter: adapter as unknown as OpenAiResponsesAdapter,
			toolRegistry: createRegistryStub() as unknown as AgenticToolRegistry,
			options: {
				maxToolCalls: 5,
				maxFetchCalls: 2,
				maxContextChars: 5000,
			},
		});

		const result = await runner.run({
			query: "what is rag",
			topK: 8,
			systemContext: "context",
		});

		expect(result.answer).toBe("final answer");
		expect(result.toolTrace.length).toBe(0);
		expect(result.usage?.totalTokens).toBe(15);
		expect(adapter.calls.length).toBe(1);
	});

	it("executes tool calls and continues with previous_response_id", async () => {
		const adapter = new StubAdapter([
			{
				responseId: "resp_1",
				text: "",
				functionCalls: [
					{
						callId: "call_1",
						name: "search_evidence",
						argumentsJson: JSON.stringify({ query: "rag" }),
					},
				],
				usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
			},
			{
				responseId: "resp_2",
				text: "done",
				functionCalls: [],
				usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 },
			},
		]);
		const runner = new AgenticSearchRunner({
			llmAdapter: adapter as unknown as OpenAiResponsesAdapter,
			toolRegistry: createRegistryStub() as unknown as AgenticToolRegistry,
			options: {
				maxToolCalls: 5,
				maxFetchCalls: 2,
				maxContextChars: 5000,
			},
		});

		const result = await runner.run({
			query: "what is rag",
			topK: 8,
			systemContext: "context",
		});

		expect(result.answer).toBe("done");
		expect(result.toolTrace.length).toBe(1);
		expect(result.toolTrace[0]?.tool).toBe("search_evidence");
		expect(result.citations.length).toBe(1);
		expect(result.usage?.totalTokens).toBe(14);
		expect(adapter.calls.length).toBe(2);
		expect(adapter.calls[1]?.previousResponseId).toBe("resp_1");
	});

	it("enforces tool budgets, records failures and returns accumulated evidence", async () => {
		const adapter = new StubAdapter([
			{
				responseId: "resp_1",
				text: "",
				functionCalls: [
					{ callId: "unknown", name: "missing", argumentsJson: "{}" },
					{ callId: "fetch-1", name: "fetch", argumentsJson: "{}" },
					{ callId: "fetch-2", name: "fetch", argumentsJson: "{}" },
					{
						callId: "error-1",
						name: "search_evidence",
						argumentsJson: "{not-json",
					},
					{
						callId: "error-2",
						name: "search_evidence",
						argumentsJson: '{"mode":"string-error"}',
					},
					{
						callId: "success",
						name: "search_evidence",
						argumentsJson: '{"mode":"success"}',
					},
					{
						callId: "budget",
						name: "search_evidence",
						argumentsJson: "{}",
					},
				],
			},
			{
				responseId: "resp_2",
				text: "   ",
				functionCalls: [],
				usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
			},
		]);
		const execute = async (name: string, args: unknown) => {
			if (name === "fetch") {
				return { output: { fetched: true }, resultCount: 1 };
			}
			if (typeof args !== "object" || args === null || !("mode" in args)) {
				throw new Error("tool failed");
			}
			if (args.mode === "string-error") {
				throw "non-error failure";
			}
			return {
				output: { hits: 1 },
				resultCount: 2,
				citations: [
					{
						kind: "wiki_fragment" as const,
						title: "Fragment",
						uri: "wiki://doc",
						locator: "chunk:1",
						wikiSlug: "tech/doc",
					},
					{
						kind: "wiki_page" as const,
						title: "Page",
						uri: "wiki://doc",
						wikiSlug: "tech/doc",
					},
					{
						kind: "web_page" as const,
						title: "Web",
						url: "https://example.com",
					},
				],
				retrieved: [{ id: "fragment-1" }],
				webResults: [{ title: "Web", url: "https://example.com" }],
			};
		};
		const registry = {
			listSpecs: () => [],
			has: (name: string) => name !== "missing",
			execute,
		};
		const log = vi.fn();
		const runner = new AgenticSearchRunner({
			llmAdapter: adapter as unknown as OpenAiResponsesAdapter,
			toolRegistry: registry as unknown as AgenticToolRegistry,
			options: {
				maxToolCalls: 2,
				maxFetchCalls: 1,
				maxContextChars: 500,
			},
			debug: true,
			log,
		});

		const result = await runner.run({
			query: "query",
			category: "tech",
			topK: 3,
			systemContext: "context",
		});

		expect(result.answer).toContain("回答を生成できませんでした");
		expect(result.toolTrace.map((item) => item.status)).toEqual([
			"skipped",
			"ok",
			"skipped",
			"error",
			"error",
			"ok",
			"skipped",
		]);
		expect(result.citations).toEqual([
			expect.objectContaining({ kind: "wiki_page" }),
			expect.objectContaining({ kind: "web_page" }),
		]);
		expect(result.retrieved).toHaveLength(1);
		expect(result.webResults).toHaveLength(1);
		expect(result.usage?.totalTokens).toBe(3);
		expect(log).toHaveBeenCalledWith(
			expect.objectContaining({ level: "warn", event: "tool.error" }),
		);
	});

	it("returns the maximum-turn fallback and supports the default logger", async () => {
		const turns: StubTurn[] = Array.from({ length: 8 }, (_, index) => ({
			responseId: `resp_${index}`,
			text: "",
			functionCalls: [
				{
					callId: `call_${index}`,
					name: "search_evidence",
					argumentsJson: "{}",
				},
			],
		}));
		const adapter = new StubAdapter(turns);
		const registry = {
			listSpecs: () => [],
			has: () => true,
			execute: async () => {
				throw "non-error failure";
			},
		};
		const runner = new AgenticSearchRunner({
			llmAdapter: adapter as unknown as OpenAiResponsesAdapter,
			toolRegistry: registry as unknown as AgenticToolRegistry,
			options: {
				maxToolCalls: 0,
				maxFetchCalls: 0,
				maxContextChars: 100,
			},
			log: () => undefined,
		});

		const result = await runner.run({
			query: "query",
			topK: 1,
			systemContext: "context",
		});
		expect(result.answer).toContain("ツール実行上限");
		expect(result.toolTrace).toHaveLength(8);
		expect(result.toolTrace.every((item) => item.status === "skipped")).toBe(
			true,
		);

		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const consoleLog = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);
		const defaultLogger = new AgenticSearchRunner({
			llmAdapter: adapter as unknown as OpenAiResponsesAdapter,
			toolRegistry: registry as unknown as AgenticToolRegistry,
			options: {
				maxToolCalls: 0,
				maxFetchCalls: 0,
				maxContextChars: 100,
			},
		});
		(defaultLogger as never as { log: Function }).log("error", "error.event");
		(defaultLogger as never as { log: Function }).log("info", "info.event");
		expect(consoleError).toHaveBeenCalled();
		expect(consoleLog).toHaveBeenCalled();
		consoleError.mockRestore();
		consoleLog.mockRestore();
	});
});
