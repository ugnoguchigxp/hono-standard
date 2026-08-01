import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildLocalContext,
	buildWebContext,
	SearchEvidenceCollector,
	toCitations,
} from "./search-evidence";

const fragment = {
	id: "fragment-1",
	sourceId: "source-1",
	sourceUri: "tech/biome.md",
	sourceCategory: "tech",
	locator: "chunk:0001",
	heading: "Biome",
	content: "Biome content",
	combinedScore: 0.9,
	wikiSlug: "tech/biome",
};

describe("SearchEvidenceCollector", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("uses the same query for full-text/vector retrieval and web search", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi
			.fn()
			.mockRejectedValue(new Error("skip page fetch")) as unknown as typeof fetch;
		const retriever = {
			evaluate: vi.fn().mockResolvedValue({
				strategy: "merged",
				vectorResults: [fragment],
				textResults: [fragment],
				mergedResults: [fragment],
				selectedResults: [fragment],
			}),
		};
		const webSearchProvider = {
			name: "exa",
			search: vi.fn().mockResolvedValue([
				{
					title: "Biome",
					url: "https://biomejs.dev",
					snippet: "Biome snippet",
					position: 1,
				},
			]),
		};
		const collector = new SearchEvidenceCollector({
			retriever: retriever as never,
			webSearchProvider,
		});

		try {
			const evidence = await collector.collect({
				query: "Biome best practices",
				topK: 5,
				category: "tech",
			});

			expect(retriever.evaluate).toHaveBeenCalledWith("Biome best practices", {
				topK: 5,
				enableTrigramFallback: true,
				category: "tech",
			});
			expect(webSearchProvider.search).toHaveBeenCalledWith({
				query: "Biome best practices",
				maxResults: 5,
				lang: "ja",
			});
			expect(evidence.retrieved).toHaveLength(1);
			expect(evidence.webResults).toHaveLength(1);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("builds empty and populated local and Web context", () => {
		expect(buildLocalContext([])).toBe("(no local markdown context found)");
		expect(buildLocalContext([{ ...fragment, heading: null } as never])).toContain(
			"heading=(none)\nBiome content",
		);
		expect(toCitations([{ ...fragment, heading: null } as never])).toEqual([
			expect.objectContaining({ title: "biome.md", heading: undefined }),
		]);

		expect(buildWebContext([])).toBe("(no web search context found)");
		expect(
			buildWebContext([
				{
					title: "A",
					url: "https://a.test",
					snippet: "One",
					position: 1,
					content: " body ",
				},
				{
					title: "B",
					url: "https://b.test",
					snippet: "Two",
					position: 2,
					content: "  ",
				},
			]),
		).toContain("Fetched content:\n body ");
	});

	it("normalizes collection inputs when no Web provider exists", async () => {
		const retriever = {
			evaluate: vi.fn().mockResolvedValue({
				strategy: "full_text",
				vectorResults: [],
				textResults: [],
				mergedResults: [],
				selectedResults: [],
			}),
		};
		const collector = new SearchEvidenceCollector({ retriever: retriever as never });

		await expect(
			collector.collect({ query: "  query  ", topK: 0, category: "  " }),
		).resolves.toMatchObject({
			query: "query",
			topK: 1,
			category: undefined,
			webResults: [],
		});
		expect(retriever.evaluate).toHaveBeenCalledWith("query", {
			topK: 1,
			enableTrigramFallback: true,
			category: undefined,
		});
	});

	it("fetches only the first two Web results and tolerates page failures", async () => {
		const retriever = {
			evaluate: vi.fn().mockResolvedValue({
				strategy: "full_text",
				vectorResults: [],
				textResults: [],
				mergedResults: [],
				selectedResults: [],
			}),
		};
		const results = [1, 2, 3].map((position) => ({
			title: `Result ${position}`,
			url: `https://example.com/${position}`,
			snippet: `Snippet ${position}`,
			position,
		}));
		const webSearchProvider = {
			name: "test",
			search: vi.fn().mockResolvedValue(results),
		};
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce(
					new Response("<main>Fetched one</main>", {
						headers: { "content-type": "text/html" },
					}),
				)
				.mockRejectedValueOnce(new Error("offline")),
		);
		const collector = new SearchEvidenceCollector({
			retriever: retriever as never,
			webSearchProvider,
		});

		const evidence = await collector.collect({ query: "query", topK: 10 });
		expect(webSearchProvider.search).toHaveBeenCalledWith({
			query: "query",
			maxResults: 5,
			lang: "ja",
		});
		expect(evidence.webResults[0]).toMatchObject({ content: "Fetched one" });
		expect(evidence.webResults[1]).not.toHaveProperty("content");
		expect(evidence.webResults[2]).not.toHaveProperty("content");
	});

	it("returns no Web results when provider search fails", async () => {
		const collector = new SearchEvidenceCollector({
			retriever: {
				evaluate: vi.fn().mockResolvedValue({
					strategy: "full_text",
					vectorResults: [],
					textResults: [],
					mergedResults: [],
					selectedResults: [],
				}),
			} as never,
			webSearchProvider: {
				name: "test",
				search: vi.fn().mockRejectedValue(new Error("offline")),
			},
		});

		await expect(
			collector.collect({ query: "query", topK: 2 }),
		).resolves.toMatchObject({ webResults: [] });
	});
});
