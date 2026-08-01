import { describe, expect, it } from "vitest";
import {
	categoryFromPageRelativePath,
	topLevelCategoriesFromFolderPaths,
} from "./category";

describe("wiki categories", () => {
	it("extracts a normalized top-level category", () => {
		expect(categoryFromPageRelativePath(" /tech\\hono.md/ ")).toBe("tech");
	});

	it("rejects empty, top-level, and traversal paths", () => {
		expect(categoryFromPageRelativePath(" ")).toBeNull();
		expect(categoryFromPageRelativePath("index.md")).toBeNull();
		expect(categoryFromPageRelativePath("../secret.md")).toBeNull();
		expect(categoryFromPageRelativePath("./page.md")).toBeNull();
	});

	it("normalizes, deduplicates, filters, and sorts folder categories", () => {
		expect(
			topLevelCategoriesFromFolderPaths([
				" /zeta/notes ",
				"alpha\\guide",
				"alpha/other",
				"",
				".",
				"../secret",
			]),
		).toEqual(["alpha", "zeta"]);
	});
});
