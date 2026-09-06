import { MarkdownTipTapConverter } from "markdown-wysiwyg-editor";
import { describe, expect, it } from "vitest";
import type { AgenticSearchCitation } from "./api";
import {
	dedupeAgenticSourceCitations,
	normalizeAgenticAnswerMarkdown,
	toAgenticSourceKey,
	toAgenticSourceLabel,
} from "./agentic-markdown";

describe("normalizeAgenticAnswerMarkdown", () => {
	it("prevents markdown-wysiwyg inline code placeholders from leaking inside bold text", async () => {
		const markdown =
			"- **`biome.jsonc` から始める**\n- CI では `biome ci .` を使う";

		const normalized = normalizeAgenticAnswerMarkdown(markdown);
		const json = await MarkdownTipTapConverter.markdownToTipTapJson(normalized);
		const serialized = JSON.stringify(json);

		expect(serialized).not.toContain("§CODE§");
		expect(serialized).toContain("biome.jsonc");
		expect(serialized).toContain("biome ci .");
		expect(serialized).toContain('"type":"code"');
	});

	it("does not rewrite fenced code blocks", () => {
		const markdown = [
			"```ts",
			"const command = `biome ci .`;",
			"```",
			"- **`biome.jsonc` を使う**",
		].join("\n");

		expect(normalizeAgenticAnswerMarkdown(markdown)).toBe(
			[
				"```ts",
				"const command = `biome ci .`;",
				"```",
				"- **biome.jsonc を使う**",
			].join("\n"),
		);
	});

	it("unwraps inline code nested in emphasis and strikethrough", () => {
		expect(
			normalizeAgenticAnswerMarkdown(
				"*Run `bun test` now* and ~~avoid `npm test`~~",
			),
		).toBe("*Run bun test now* and ~~avoid npm test~~");
	});
});

describe("dedupeAgenticSourceCitations", () => {
	it("collapses chunk citations to one source-level citation", () => {
		const citations: AgenticSearchCitation[] = [
			{
				kind: "wiki_fragment",
				title: "Biome chunk",
				uri: "tech/biome.md#chunk-1",
				wikiSlug: "tech/biome",
			},
			{
				kind: "wiki_page",
				title: "Biome ベストプラクティス",
				uri: "tech/biome.md",
				wikiSlug: "tech/biome",
			},
		];

		expect(dedupeAgenticSourceCitations(citations)).toEqual([citations[1]]);
	});

	it("builds stable keys and labels for every citation shape", () => {
		const wiki = {
			kind: "wiki_page",
			title: "Wiki",
			wikiSlug: "tech/wiki",
		} as AgenticSearchCitation;
		const web = {
			kind: "web_page",
			title: "",
			url: "https://example.com",
		} as AgenticSearchCitation;
		const uri = {
			kind: "wiki_fragment",
			title: "",
			uri: "file:///guide.md",
		} as AgenticSearchCitation;
		const title = {
			kind: "wiki_fragment",
			title: "Only title",
		} as AgenticSearchCitation;
		const empty = {
			kind: "wiki_fragment",
			title: "",
		} as AgenticSearchCitation;

		expect(toAgenticSourceKey(wiki)).toBe("wiki:tech/wiki");
		expect(toAgenticSourceKey(web)).toBe("url:https://example.com");
		expect(toAgenticSourceKey(uri)).toBe("uri:file:///guide.md");
		expect(toAgenticSourceKey(title)).toBe("title:wiki_fragment:Only title");
		expect(toAgenticSourceLabel(web)).toBe("https://example.com");
		expect(toAgenticSourceLabel(uri)).toBe("file:///guide.md");
		expect(toAgenticSourceLabel(empty)).toBe("Source");
		expect(dedupeAgenticSourceCitations([wiki, wiki])).toEqual([wiki]);
	});
});
