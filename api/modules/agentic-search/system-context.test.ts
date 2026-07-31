import { describe, expect, it } from "vitest";
import { buildAgenticSystemContext } from "./system-context";

describe("buildAgenticSystemContext", () => {
	it("includes defaults and user context", () => {
		const context = buildAgenticSystemContext({
			userSystemContext: "Answer with strict citations.",
			category: "tech",
			topK: 8,
		});
		expect(context).toContain("search_evidence");
		expect(context).toContain("全文検索");
		expect(context).toContain("ベクトル検索");
		expect(context).toContain("Web 検索");
		expect(context).toContain("Answer with strict citations.");
		expect(context).toContain("category=tech");
	});

	it("works without user context", () => {
		const context = buildAgenticSystemContext({
			userSystemContext: "   ",
			topK: 4,
		});
		expect(context).toContain("topK=4");
		expect(context).toContain("category=all");
	});

	it("renders the English catalog translation explicitly", () => {
		const context = buildAgenticSystemContext({
			userSystemContext: "Use strict citations.",
			topK: 6,
			instructionLocale: "en-US",
		});
		expect(context).toContain("full-text");
		expect(context).toContain("Answer concisely and accurately in English");
	});
});
