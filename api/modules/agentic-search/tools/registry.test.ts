import { afterEach, describe, expect, it, vi } from "vitest";
import type { SourceRepository } from "../../sources/source.repository";
import { AgenticToolRegistry } from "./registry";
import type { AgenticToolDeps, AgenticToolRuntimeContext } from "./types";

const runtime: AgenticToolRuntimeContext = {
	query: "query",
	category: "tech",
	topK: 4,
	fetchCount: 0,
	maxFetchCalls: 2,
	maxContextChars: 300,
};

function createDeps(overrides: Partial<AgenticToolDeps> = {}): AgenticToolDeps {
	return {
		sourceRepository: {
			getSourceById: vi.fn(),
			getSourceByUri: vi.fn(),
		} as unknown as SourceRepository,
		createEmbedding: vi.fn().mockResolvedValue([]),
		readWikiPage: vi.fn().mockResolvedValue(null),
		maxContextChars: 300,
		...overrides,
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("AgenticToolRegistry", () => {
	it("exposes all supported tools and rejects unknown tools", async () => {
		const registry = new AgenticToolRegistry(createDeps());

		expect(registry.listSpecs().map((item) => item.name)).toEqual([
			"search_evidence",
			"wiki_read",
			"web_search",
			"fetch",
		]);
		expect(registry.has("fetch")).toBe(true);
		expect(registry.has("missing")).toBe(false);
		await expect(registry.execute("missing", {}, runtime)).rejects.toThrow(
			"Unknown tool: missing",
		);
	});

	it("reads wiki pages and database sources through every lookup mode", async () => {
		const readWikiPage = vi
			.fn()
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({
				title: "Wiki",
				slug: "tech/wiki",
				path: "tech/wiki.md",
				body: "x".repeat(500),
			});
		const sourceRepository = {
			getSourceById: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
				title: null,
				uri: "db://source",
				body: "database body",
				metadata: null,
			}),
			getSourceByUri: vi.fn().mockResolvedValue({
				title: "URI source",
				uri: "db://uri",
				body: "uri body",
				metadata: { wikiSlug: "tech/uri" },
			}),
		};
		const registry = new AgenticToolRegistry(
			createDeps({
				readWikiPage,
				sourceRepository: sourceRepository as unknown as SourceRepository,
			}),
		);

		expect(
			(await registry.execute("wiki_read", { wikiSlug: "missing" }, runtime))
				.resultCount,
		).toBe(0);
		const wiki = await registry.execute(
			"wiki_read",
			{ wikiSlug: "tech/wiki", maxChars: 200 },
			runtime,
		);
		expect(wiki).toMatchObject({
			resultCount: 1,
			output: { found: true, truncated: true },
		});
		expect(
			(await registry.execute("wiki_read", { sourceId: "missing" }, runtime))
				.resultCount,
		).toBe(0);
		const byId = await registry.execute(
			"wiki_read",
			{ sourceId: "source-1" },
			runtime,
		);
		expect(byId.citations?.[0]).toMatchObject({
			title: "db://source",
			wikiSlug: null,
		});
		const byUri = await registry.execute(
			"wiki_read",
			{ sourceUri: "db://uri" },
			runtime,
		);
		expect(byUri.citations?.[0]).toMatchObject({
			title: "URI source",
			wikiSlug: "tech/uri",
		});
	});

	it("fetches safe HTML and plain text while refusing unsafe URLs", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					"<html><head><title> Example </title></head><body><nav>skip</nav><main>Hello   world</main></body></html>",
					{ headers: { "content-type": "text/html" } },
				),
			)
			.mockResolvedValueOnce(
				new Response("plain   body", {
					headers: { "content-type": "text/plain" },
				}),
			);
		vi.stubGlobal("fetch", fetchMock);
		const registry = new AgenticToolRegistry(createDeps());

		expect(
			(await registry.execute("fetch", { url: "file:///etc/passwd" }, runtime))
				.resultCount,
		).toBe(0);
		const html = await registry.execute(
			"fetch",
			{ url: "https://example.com", maxChars: 200 },
			runtime,
		);
		expect(html).toMatchObject({
			resultCount: 1,
			output: { title: "Example", text: "Hello world", fetched: true },
		});
		const text = await registry.execute(
			"fetch",
			{ url: "https://example.com/plain" },
			runtime,
		);
		expect(text.output).toMatchObject({
			title: "https://example.com/plain",
			text: "plain body",
		});
	});

	it("handles configured and degraded web and evidence search", async () => {
		const degraded = new AgenticToolRegistry(
			createDeps({ webSearchUnavailableMessage: "disabled" }),
		);
		expect(
			await degraded.execute("web_search", { query: "news" }, runtime),
		).toMatchObject({
			resultCount: 0,
			output: { degraded: true, message: "disabled" },
		});
		expect(
			await degraded.execute("search_evidence", { query: "local" }, runtime),
		).toMatchObject({
			resultCount: 0,
			output: { degraded: true, topK: 4 },
		});

		const search = vi.fn().mockResolvedValue([
			{ title: "", url: "https://example.com/a", snippet: "A", position: 1 },
			{ title: "B", url: "https://example.com/b", snippet: "B", position: 2 },
		]);
		const configured = new AgenticToolRegistry(
			createDeps({
				webSearchProvider: { name: undefined, search } as never,
			}),
		);
		const result = await configured.execute(
			"web_search",
			{ query: "news", maxResults: 2 },
			runtime,
		);
		expect(search).toHaveBeenCalledWith({ query: "news", maxResults: 2 });
		expect(result).toMatchObject({
			resultCount: 2,
			output: { provider: "web" },
			citations: [{ title: "https://example.com/a" }, { title: "B" }],
		});
	});
});
