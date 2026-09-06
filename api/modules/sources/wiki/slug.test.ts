import { describe, expect, it } from "vitest";
import {
	assertSafeSlug,
	extractRemainderFromPathname,
	filePathToSlug,
	isSafeSlug,
	sanitizeSlug,
} from "./slug";

describe("wiki slugs", () => {
	it("extracts and decodes a route remainder", () => {
		expect(extractRemainderFromPathname("/pages/tech%2Fhono/", "/pages")).toBe(
			"tech/hono",
		);
		expect(extractRemainderFromPathname("/other", "/pages")).toBe("");
		expect(extractRemainderFromPathname("/pages/%E0%A4%A", "/pages")).toBe(
			"\0",
		);
	});

	it("maps markdown file paths to slugs", () => {
		expect(filePathToSlug("index.md")).toBe("");
		expect(filePathToSlug("tech/index.md")).toBe("tech");
		expect(filePathToSlug("tech/guide.MD")).toBe("tech/guide");
	});

	it("sanitizes and validates safe slugs", () => {
		expect(sanitizeSlug(" /tech\\hono//routing/ ")).toBe("tech/hono/routing");
		expect(isSafeSlug("")).toBe(true);
		expect(isSafeSlug("tech/hono")).toBe(true);
		expect(isSafeSlug("tech/../secret")).toBe(false);
		expect(isSafeSlug("bad\0slug")).toBe(false);
		expect(assertSafeSlug(" /tech/hono/ ")).toBe("tech/hono");
		expect(() => assertSafeSlug("../secret")).toThrow("Invalid page slug");
	});
});
