import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSearchService } from "./WebSearchService";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("WebSearchService", () => {
	it("delegates search and extracts clean, truncated HTML content", async () => {
		const search = vi.fn().mockResolvedValue([{ title: "Result" }]);
		const service = new WebSearchService({ name: "test", search } as never, {
			maxContentLength: 12,
		});
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					"<html><head><title> Page </title></head><body><nav>menu</nav><main>Hello   useful world</main></body></html>",
					{ headers: { "content-type": "text/html; charset=utf-8" } },
				),
			),
		);

		expect(await service.search({ query: "q" })).toEqual([{ title: "Result" }]);
		expect(search).toHaveBeenCalledWith({ query: "q" });
		const page = await service.fetchPageContent("https://example.com/page");
		expect(page).toMatchObject({
			url: "https://example.com/page",
			title: "Page",
			cleanText: "Hello useful...",
			extractedAt: expect.any(Date),
		});
	});

	it("accepts plain text and rejects unsupported or failed responses", async () => {
		const service = new WebSearchService(
			{ name: "test", search: vi.fn() } as never,
			{ maxContentLength: 100 },
		);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response("Plain body", {
					headers: { "content-type": "text/plain" },
				}),
			)
			.mockResolvedValueOnce(
				new Response("binary", {
					headers: { "content-type": "application/octet-stream" },
				}),
			)
			.mockResolvedValueOnce(
				new Response("unavailable", {
					status: 503,
					statusText: "Unavailable",
				}),
			);
		vi.stubGlobal("fetch", fetchMock);

		expect(
			await service.fetchPageContent("https://example.com/plain"),
		).toMatchObject({ title: "", cleanText: "Plain body" });
		await expect(
			service.fetchPageContent("https://example.com/binary"),
		).rejects.toThrow("Unsupported content type");
		await expect(
			service.fetchPageContent("https://example.com/down"),
		).rejects.toThrow("Failed to fetch page: HTTP error: 503 Unavailable");
	});

	it("falls back to Cheerio when DOM parsing cannot use the URL", () => {
		const service = new WebSearchService({
			name: "test",
			search: vi.fn(),
		} as never);
		const text = (
			service as never as {
				extractCleanText(html: string, url: string): string;
			}
		).extractCleanText(
			"<body><header>skip</header><p>Fallback   text</p></body>",
			":not-a-url",
		);
		expect(text).toBe("Fallback text");
	});
});
