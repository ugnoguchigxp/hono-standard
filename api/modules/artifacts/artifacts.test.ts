import { describe, expect, it } from "vitest";
import {
	appContentSecurityPolicy,
	serializeContentSecurityPolicy,
	viteDevContentSecurityPolicy,
} from "../../app/security-headers";
import { extractArtifactsFromText } from "./extract";
import { parseLooseStructuredText } from "./parse";

describe("artifact extraction", () => {
	it("extracts supported structured and text artifacts", () => {
		const result = extractArtifactsFromText(`
Intro
<artifact type="json" title=" Payload ">{"ok":true}</artifact>
<artifact type="markdown"> # Notes </artifact>
<artifact type="table">[{"name":"A"}]</artifact>
Outro
		`);

		expect(result.cleanText).toBe("Intro\n\n\n\nOutro");
		expect(result.artifacts).toHaveLength(3);
		expect(result.artifacts[0]).toMatchObject({
			type: "json",
			title: "Payload",
			content: { ok: true },
			version: 1,
			metadata: {},
		});
		expect(result.artifacts[1]).toMatchObject({
			type: "markdown",
			content: "# Notes",
		});
		expect(result.artifacts[2]?.content).toEqual([{ name: "A" }]);
		expect(result.artifacts.every((item) => item.id.length > 0)).toBe(true);
	});

	it("drops unsupported blocks and preserves malformed structured content as text", () => {
		const result = extractArtifactsFromText(
			'<artifact type="unknown">secret</artifact><artifact type="chart">{bad</artifact>',
		);

		expect(result.cleanText).toBe("");
		expect(result.artifacts).toEqual([
			expect.objectContaining({
				type: "chart",
				title: undefined,
				content: "{bad",
			}),
		]);
		expect(parseLooseStructuredText(" true ")).toBe(true);
		expect(parseLooseStructuredText(" not-json ")).toBe("not-json");
	});
});

describe("content security policy", () => {
	it("serializes production and Vite development directives", () => {
		const production = serializeContentSecurityPolicy(appContentSecurityPolicy);
		const development = serializeContentSecurityPolicy(
			viteDevContentSecurityPolicy,
		);

		expect(production).toContain("default-src 'self'");
		expect(production).toContain("frame-ancestors 'self'");
		expect(development).toContain("connect-src 'self' ws:");
		expect(development).toContain("'unsafe-eval'");
	});
});
