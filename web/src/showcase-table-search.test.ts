import { describe, expect, it } from "vitest";
import {
	defaultShowcaseTableSearch,
	isShowcaseSortField,
	parseShowcaseTableSearch,
} from "./showcase-table-search";

describe("showcase table search", () => {
	it("uses defaults for missing or invalid values", () => {
		expect(parseShowcaseTableSearch({})).toEqual({
			...defaultShowcaseTableSearch,
			sortBy: undefined,
			sortDir: undefined,
		});
		expect(
			parseShowcaseTableSearch({
				page: 0,
				pageSize: 12,
				sortBy: "unknown",
				sortDir: "sideways",
			}),
		).toEqual({
			...defaultShowcaseTableSearch,
			sortBy: undefined,
			sortDir: undefined,
		});
	});

	it("parses valid pagination and sorting values", () => {
		expect(
			parseShowcaseTableSearch({
				page: "3",
				pageSize: "20",
				sortBy: "category",
			}),
		).toEqual({
			page: 3,
			pageSize: 20,
			sortBy: "category",
			sortDir: "asc",
		});
		expect(
			parseShowcaseTableSearch({
				page: 2,
				pageSize: 50,
				sortBy: "status",
				sortDir: "desc",
			}),
		).toEqual({
			page: 2,
			pageSize: 50,
			sortBy: "status",
			sortDir: "desc",
		});
	});

	it("recognizes only supported sort fields", () => {
		expect(isShowcaseSortField("component")).toBe(true);
		expect(isShowcaseSortField("category")).toBe(true);
		expect(isShowcaseSortField("status")).toBe(true);
		expect(isShowcaseSortField("createdAt")).toBe(false);
		expect(isShowcaseSortField(null)).toBe(false);
	});
});
