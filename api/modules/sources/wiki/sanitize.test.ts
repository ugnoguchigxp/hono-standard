import { describe, expect, it } from "vitest";
import { sanitizeMarkdownBody, sanitizePlainText } from "./sanitize";

describe("wiki sanitization", () => {
	it("keeps safe HTML and hardens links opened in a new tab", () => {
		const sanitized = sanitizeMarkdownBody(
			'<details class="box"><summary>More</summary><a href="https://example.com" target="_blank">site</a><img src="https://example.com/a.png" alt="a"><kbd>⌘K</kbd></details>',
		);

		expect(sanitized).toContain("<details");
		expect(sanitized).toContain('rel="noopener noreferrer"');
		expect(sanitized).toContain("<img");
		expect(sanitized).toContain("<kbd>");
	});

	it.each([
		["[safe](https://example.com)", "[safe](https://example.com)"],
		["[mail](mailto:test@example.com)", "[mail](mailto:test@example.com)"],
		["[anchor](#section)", "[anchor](#section)"],
		["[empty]()", "[empty]()"],
		["[relative](./child.md)", "[relative](./child.md)"],
		["[query](child.md?q=1#part)", "[query](child.md?q=1#part)"],
		[
			'[unsafe](javascript:alert "title")',
			'[unsafe](#blocked-unsafe-url "title")',
		],
		["[network](//evil.example)", "[network](#blocked-unsafe-url)"],
		["[traversal](../secret)", "[traversal](#blocked-unsafe-url)"],
		["[windows](..\\secret)", "[windows](#blocked-unsafe-url)"],
		["![mail](mailto:test@example.com)", "![mail](#blocked-unsafe-url)"],
		["![web](http://example.com/a.png)", "![web](http://example.com/a.png)"],
	])("sanitizes Markdown URL %s", (input, expected) => {
		expect(sanitizeMarkdownBody(input)).toBe(expected);
	});

	it("sanitizes reference URLs and removes active HTML", () => {
		const result = sanitizeMarkdownBody(`
[safe]: https://example.com "safe"
[unsafe]: data:text/html,boom "bad"
<script>alert(1)</script><iframe src="https://evil.example"></iframe>
		`);
		expect(result).toContain('[safe]: https://example.com "safe"');
		expect(result).toContain('[unsafe]: #blocked-unsafe-url "bad"');
		expect(result).not.toContain("<script");
		expect(result).not.toContain("<iframe");
	});

	it("returns trimmed plain text without markup or control characters", () => {
		expect(sanitizePlainText(" \u0000<b>Hello</b>\u007f\nworld ")).toBe(
			"Helloworld",
		);
	});
});
