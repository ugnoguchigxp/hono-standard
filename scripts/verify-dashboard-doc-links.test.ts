import { describe, expect, it } from "vitest";
import { extractMarkdownTargets } from "./verify-dashboard-doc-links";

describe("dashboard documentation link gate", () => {
	it("extracts local links and ignores external destinations at verification time", () => {
		expect(
			extractMarkdownTargets(
				'[plan](./04-testing-and-delivery.md#d12) [site](https://example.com) [mail](mailto:a@example.com)',
			),
		).toEqual(["./04-testing-and-delivery.md#d12", "https://example.com", "mailto:a@example.com"]);
	});
});
