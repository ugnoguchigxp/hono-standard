import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	injectSsrHtml,
	publicRoutesForPackage,
	routeOutputPath,
} from "./build-ssg";

describe("SSG build helpers", () => {
	it("injects rendered markup into the client template", () => {
		expect(
			injectSsrHtml('<div id="root"><!--ssr-outlet--></div>', "<main>Home</main>"),
		).toBe('<div id="root"><main>Home</main></div>');
	});

	it("requires the SSR outlet marker", () => {
		expect(() => injectSsrHtml("<html></html>", "content")).toThrow(
			/ssr-outlet/,
		);
	});

	it("maps public routes to deterministic HTML paths", () => {
		expect(routeOutputPath("/output", "/")).toBe(
			path.join("/output", "index.html"),
		);
		expect(routeOutputPath("/output", "/showcase")).toBe(
			path.join("/output", "showcase", "index.html"),
		);
		expect(() => routeOutputPath("/output", "/../secret")).toThrow(
			/Invalid static route/,
		);
	});

	it("limits authless output to its remaining public route", () => {
		expect(publicRoutesForPackage("hono-standard-authless")).toEqual(["/"]);
		expect(publicRoutesForPackage("hono-standard")).toEqual([
			"/",
			"/showcase",
			"/login",
		]);
	});
});
