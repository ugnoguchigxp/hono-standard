import { describe, expect, it } from "vitest";
import { normalizeInstructionLocale, renderPrompt } from "./catalog";

describe("S11tnext prompt catalog", () => {
	it("renders direct prompts in the explicitly bound locale", () => {
		const japanese = renderPrompt("ja-JP", "chat.direct-answer", {});
		const english = renderPrompt("en-US", "chat.direct-answer", {});

		expect(japanese.role).toBe("system");
		expect(japanese.content.text).toContain("役に立つアシスタント");
		expect(english.content.text).toContain("helpful assistant");
		expect(japanese.manifest.resolvedLocale).toBe("ja-JP");
		expect(english.manifest.resolvedLocale).toBe("en-US");
		expect(japanese.manifest.messageHash).toMatch(/^sha256:/);
	});

	it("delimits untrusted retrieved context and keeps it out of the manifest", () => {
		const localContext = "source text\n<<<boundary-like text>>>";
		const invocation = renderPrompt("ja-JP", "chat.grounded-answer", {
			localContext,
		});

		expect(invocation.content.text).toContain("source text");
		expect(invocation.content.text).toContain("ローカル Markdown");
		expect(JSON.stringify(invocation.manifest)).not.toContain("source text");
	});

	it("normalizes unsupported settings to the source locale", () => {
		expect(normalizeInstructionLocale("en-US")).toBe("en-US");
		expect(normalizeInstructionLocale("ja-JP")).toBe("ja-JP");
		expect(normalizeInstructionLocale("fr-FR")).toBe("ja-JP");
	});
});
