import { describe, expect, it } from "vitest";
import {
	updatePageContentInputSchema,
	updatePageContentResponseSchema,
} from "./page-content.schema";
import { EMPTY_PAGE_VALUE } from "./pages.schema";

/**
 * Values produced by platejs 53.3.14 `createPlateEditor` with
 * `ParagraphPlugin`, `H1Plugin`, `H2Plugin`, `BoldPlugin`, and `ItalicPlugin`.
 * Block `id` is the core node-id nanoid, not an invented field.
 */
const plateFixtures = {
	emptyParagraph: [{ type: "p", children: [{ text: "" }], id: "G-VMVhi3Bb" }],
	heading1: [{ type: "h1", children: [{ text: "hello" }], id: "HvaUDqChnK" }],
	boldParagraph: [
		{
			type: "p",
			children: [{ text: "hello", bold: true }],
			id: "_vZLcPNN0n",
		},
	],
	italicParagraph: [
		{
			type: "p",
			children: [{ text: "hello", italic: true }],
			id: "cMHb6vsbjM",
		},
	],
} as const;

const allowedBlockKeys = new Set(["type", "children", "id"]);
const allowedTextKeys = new Set(["text", "bold", "italic"]);

describe("page content fixtures", () => {
	it("accepts Plate onChange values whose keys stay inside the allowed set", () => {
		for (const value of Object.values(plateFixtures)) {
			for (const block of value) {
				expect(
					Object.keys(block).every((key) => allowedBlockKeys.has(key)),
				).toBe(true);
				for (const child of block.children) {
					expect(
						Object.keys(child).every((key) => allowedTextKeys.has(key)),
					).toBe(true);
				}
			}
			expect(
				updatePageContentInputSchema.parse({ revision: 0, value }),
			).toEqual({ revision: 0, value });
		}
	});

	it("accepts the initial empty paragraph saved before Plate assigns an id", () => {
		expect(
			updatePageContentInputSchema.parse({
				revision: 0,
				value: EMPTY_PAGE_VALUE,
			}),
		).toEqual({ revision: 0, value: EMPTY_PAGE_VALUE });
	});

	it("accepts the largest revision that can still be incremented", () => {
		expect(
			updatePageContentInputSchema.parse({
				revision: Number.MAX_SAFE_INTEGER - 1,
				value: plateFixtures.emptyParagraph,
			}).revision,
		).toBe(Number.MAX_SAFE_INTEGER - 1);
	});
});

describe("updatePageContentInputSchema", () => {
	it("rejects unknown structure, marks, and revision values", () => {
		const rejected = [
			{ revision: 0, value: [] },
			{
				revision: 0,
				value: [{ type: "blockquote", children: [{ text: "x" }] }],
			},
			{
				revision: 0,
				value: [
					{ type: "p", children: [{ text: "x", href: "https://example.com" }] },
				],
			},
			{
				revision: 0,
				value: [{ type: "p", className: "x", children: [{ text: "x" }] }],
			},
			{
				revision: 0,
				value: [{ type: "p", id: "<script>", children: [{ text: "x" }] }],
			},
			{
				revision: 0,
				value: [{ type: "p", children: [] }],
			},
			{ revision: -1, value: plateFixtures.emptyParagraph },
			{ revision: 1.5, value: plateFixtures.emptyParagraph },
			{
				revision: Number.MAX_SAFE_INTEGER,
				value: plateFixtures.emptyParagraph,
			},
			{ revision: "0", value: plateFixtures.emptyParagraph },
			{
				revision: 0,
				value: plateFixtures.emptyParagraph,
				ownerId: "a1a1a1a1-a1a1-41a1-a1a1-a1a1a1a1a1a1",
			},
		];

		for (const input of rejected) {
			expect(updatePageContentInputSchema.safeParse(input).success).toBe(false);
		}
	});

	it("rejects content above the block, child, text, and byte limits", () => {
		const paragraph = (text: string) => ({
			type: "p" as const,
			children: [{ text }],
		});
		expect(
			updatePageContentInputSchema.safeParse({
				revision: 0,
				value: Array.from({ length: 1001 }, () => paragraph("x")),
			}).success,
		).toBe(false);
		expect(
			updatePageContentInputSchema.safeParse({
				revision: 0,
				value: [
					{
						type: "p",
						children: Array.from({ length: 201 }, () => ({ text: "x" })),
					},
				],
			}).success,
		).toBe(false);
		expect(
			updatePageContentInputSchema.safeParse({
				revision: 0,
				value: [paragraph("a".repeat(100_001))],
			}).success,
		).toBe(false);
		expect(
			updatePageContentInputSchema.safeParse({
				revision: 0,
				value: Array.from({ length: 11 }, () => paragraph("a".repeat(100_000))),
			}).success,
		).toBe(false);
		expect(
			updatePageContentInputSchema.safeParse({
				revision: 0,
				value: Array.from({ length: 10 }, () => paragraph("a".repeat(100_000))),
			}).success,
		).toBe(true);
	});
});

describe("updatePageContentResponseSchema", () => {
	const page = {
		id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
		updatedAt: "2026-09-30T00:00:00.000Z",
	};
	it("requires the saved revision to increase from zero", () => {
		expect(
			updatePageContentResponseSchema.parse({
				content: { revision: 1, value: plateFixtures.heading1 },
				page,
			}),
		).toEqual({
			content: { revision: 1, value: plateFixtures.heading1 },
			page,
		});
		expect(
			updatePageContentResponseSchema.safeParse({
				content: { revision: 0, value: plateFixtures.heading1 },
				page,
			}).success,
		).toBe(false);
	});
});
