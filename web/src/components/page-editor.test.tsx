import { SlashPlugin } from "@platejs/slash-command/react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TRange, Value } from "platejs";
import type { PlateEditor } from "platejs/react";
import { describe, expect, it, vi } from "vitest";
import { pageContentValueSchema } from "../../../shared/schemas/page-content.schema";
import { PageEditor } from "./page-editor";

const emptyValue: Value = [{ type: "p", children: [{ text: "" }] }];

function renderEditor(
	props: Partial<{
		pageId: string;
		initialValue: Value;
	}> = {},
) {
	const onChange = vi.fn<(value: Value) => void>();
	const view = render(
		<PageEditor
			initialValue={props.initialValue ?? emptyValue}
			onChange={onChange}
			pageId={props.pageId ?? "page-a"}
		/>,
	);
	return { ...view, onChange };
}

function editorFrom(container: HTMLElement): PlateEditor {
	const textbox = container.querySelector("[data-slate-editor]");
	if (!(textbox instanceof HTMLElement)) {
		throw new Error("editor textbox missing");
	}
	const fiberKey = Object.keys(textbox).find(
		(key) =>
			key.startsWith("__reactFiber$") ||
			key.startsWith("__reactInternalInstance$"),
	);
	let fiber: unknown = fiberKey
		? (textbox as unknown as Record<string, unknown>)[fiberKey]
		: null;
	const seen = new Set<unknown>();
	while (fiber && typeof fiber === "object" && !seen.has(fiber)) {
		seen.add(fiber);
		const props = (fiber as { memoizedProps?: { editor?: PlateEditor } })
			.memoizedProps;
		if (props?.editor && typeof props.editor.tf?.insertText === "function") {
			return props.editor;
		}
		fiber = (fiber as { return?: unknown }).return;
	}
	throw new Error("Plate editor instance was not found");
}

async function selectRange(editor: PlateEditor, start: number, end: number) {
	const range: TRange = {
		anchor: { path: [0, 0], offset: start },
		focus: { path: [0, 0], offset: end },
	};
	await act(async () => {
		editor.tf.select(range);
		await Promise.resolve();
	});
}

async function insertText(editor: PlateEditor, text: string) {
	await act(async () => {
		editor.tf.insertText(text, { marks: false });
		await Promise.resolve();
	});
}

function textOf(value: Value): string {
	return JSON.stringify(value);
}

function expectSavableContent(value: Value) {
	const parsed = pageContentValueSchema.safeParse(value);
	expect(parsed.success, JSON.stringify(parsed)).toBe(true);
}

describe("PageEditor", () => {
	it("shows an empty paragraph and reports typed text without reporting selection moves", async () => {
		const { container, onChange } = renderEditor();
		const editor = editorFrom(container);

		expect(screen.getByRole("textbox", { name: "本文" })).toBeVisible();
		expect(container.querySelector("p")).toBeInTheDocument();
		expect(onChange).not.toHaveBeenCalled();

		await selectRange(editor, 0, 0);
		expect(onChange).not.toHaveBeenCalled();

		await insertText(editor, "hello");

		expect(onChange).toHaveBeenCalledTimes(1);
		const typed = onChange.mock.calls[0]?.[0] as Value;
		expect(typed[0]?.type).toBe("p");
		expect(textOf(typed)).toContain("hello");
		expectSavableContent(typed);
		expect(screen.getByText("hello")).toBeVisible();
		expect(screen.getByRole("button", { name: "段落" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);

		const callsAfterType = onChange.mock.calls.length;
		await selectRange(editor, 1, 4);
		expect(onChange).toHaveBeenCalledTimes(callsAfterType);
	});

	it("switches the same paragraph between paragraph, heading 1, and heading 2", async () => {
		const user = userEvent.setup();
		const { container, onChange } = renderEditor({
			initialValue: [{ type: "p", children: [{ text: "hello" }] }],
		});
		const editor = editorFrom(container);
		await selectRange(editor, 0, 5);

		await user.click(screen.getByRole("button", { name: "見出し1" }));

		const headingValue = onChange.mock.calls.at(-1)?.[0] as Value;
		expect(headingValue[0]?.type).toBe("h1");
		expect(textOf(headingValue)).toContain("hello");
		expectSavableContent(headingValue);
		expect(
			screen.getByRole("heading", { level: 1, name: "hello" }),
		).toBeVisible();
		expect(screen.getByRole("button", { name: "見出し1" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);

		await user.click(screen.getByRole("button", { name: "見出し2" }));

		const secondHeading = onChange.mock.calls.at(-1)?.[0] as Value;
		expect(secondHeading[0]?.type).toBe("h2");
		expect(textOf(secondHeading)).toContain("hello");
		expect(
			screen.getByRole("heading", { level: 2, name: "hello" }),
		).toBeVisible();
		expect(screen.getByRole("button", { name: "見出し2" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);

		await user.click(screen.getByRole("button", { name: "段落" }));

		const paragraph = onChange.mock.calls.at(-1)?.[0] as Value;
		expect(paragraph[0]?.type).toBe("p");
		expect(textOf(paragraph)).toContain("hello");
		expectSavableContent(paragraph);
		expect(container.querySelector("p")).toHaveTextContent("hello");
		expect(screen.getByRole("button", { name: "段落" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	});

	it("applies a selected block type to every mixed block even when the first already matches", async () => {
		const user = userEvent.setup();
		const { container, onChange } = renderEditor({
			initialValue: [
				{ type: "h1", children: [{ text: "first" }] },
				{ type: "p", children: [{ text: "second" }] },
				{ type: "h2", children: [{ text: "third" }] },
			],
		});
		const editor = editorFrom(container);
		await act(async () => {
			editor.tf.select({
				anchor: { path: [0, 0], offset: 0 },
				focus: { path: [2, 0], offset: 5 },
			});
			await Promise.resolve();
		});

		await user.click(screen.getByRole("button", { name: "見出し1" }));

		const selected = onChange.mock.calls.at(-1)?.[0] as Value;
		expect(selected.map((block) => block.type)).toEqual(["h1", "h1", "h1"]);
		expect(selected).toMatchObject([
			{ children: [{ text: "first" }] },
			{ children: [{ text: "second" }] },
			{ children: [{ text: "third" }] },
		]);
		expectSavableContent(selected);
		expect(container.querySelectorAll("h1")).toHaveLength(3);
		expect(container.querySelector("[data-slate-editor]")).toHaveTextContent(
			"firstsecondthird",
		);
	});

	it("filters slash commands and applies the keyboard selection without saving the temporary node", async () => {
		const user = userEvent.setup();
		const { container, onChange } = renderEditor();
		const editor = editorFrom(container);
		await selectRange(editor, 0, 0);
		await insertText(editor, "/");

		const search = await screen.findByRole("textbox", {
			name: "ブロックを検索",
		});
		expect(screen.getByRole("listbox", { name: "ブロック" })).toBeVisible();
		expect(onChange).not.toHaveBeenCalled();

		fireEvent.change(search, { target: { value: "h" } });
		expect(search).toHaveValue("h");
		expect(
			screen.queryByRole("option", { name: "段落" }),
		).not.toBeInTheDocument();
		expect(await screen.findAllByRole("option")).toHaveLength(2);
		await user.keyboard("{ArrowDown}{Enter}");

		const chosen = onChange.mock.calls.at(-1)?.[0] as Value;
		expect(chosen.map((block) => block.type)).toEqual(["h2"]);
		expect(JSON.stringify(chosen)).not.toContain("slash_input");
		expectSavableContent(chosen);
		expect(screen.getByRole("heading", { level: 2 })).toBeVisible();
	});

	it("uses menu clicks and Escape without persisting the slash input", async () => {
		const user = userEvent.setup();
		const { container, onChange } = renderEditor();
		const editor = editorFrom(container);
		await selectRange(editor, 0, 0);
		await insertText(editor, "/");
		const search = await screen.findByRole("textbox", {
			name: "ブロックを検索",
		});
		await user.click(screen.getByRole("option", { name: "見出し1" }));

		const chosen = onChange.mock.calls.at(-1)?.[0] as Value;
		expect(chosen[0]?.type).toBe("h1");
		expect(JSON.stringify(chosen)).not.toContain("slash_input");
		expectSavableContent(chosen);
		expect(search).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "段落" }));
		const nextEditor = editorFrom(container);
		await selectRange(nextEditor, 0, 0);
		await insertText(nextEditor, "/");
		await screen.findByRole("textbox", { name: "ブロックを検索" });
		await user.keyboard("{Escape}");

		expect(
			screen.queryByRole("listbox", { name: "ブロック" }),
		).not.toBeInTheDocument();
		expect(JSON.stringify(onChange.mock.calls.at(-1)?.[0])).not.toContain(
			"slash_input",
		);
	});

	it("leaves slash as ordinary text outside an empty paragraph", async () => {
		const { container, onChange } = renderEditor({
			initialValue: [{ type: "p", children: [{ text: "hello" }] }],
		});
		const editor = editorFrom(container);
		await selectRange(editor, 0, 0);
		await insertText(editor, "/");

		expect(
			screen.queryByRole("listbox", { name: "ブロック" }),
		).not.toBeInTheDocument();
		expect(JSON.stringify(onChange.mock.calls.at(-1)?.[0])).toContain("/hello");
		expectSavableContent(onChange.mock.calls.at(-1)?.[0] as Value);
	});

	it("applies and removes bold and italic on the selected text only", async () => {
		const user = userEvent.setup();
		const { container, onChange } = renderEditor({
			initialValue: [{ type: "p", children: [{ text: "hello" }] }],
		});
		const editor = editorFrom(container);
		await selectRange(editor, 1, 4);

		await user.click(screen.getByRole("button", { name: "太字" }));

		const boldValue = onChange.mock.calls.at(-1)?.[0] as Value;
		expect(boldValue[0]?.children).toEqual([
			{ text: "h" },
			{ text: "ell", bold: true },
			{ text: "o" },
		]);
		expectSavableContent(boldValue);
		expect(container.querySelector("strong")).toHaveTextContent("ell");
		expect(screen.getByRole("button", { name: "太字" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);

		const callsAfterBold = onChange.mock.calls.length;
		await act(async () => {
			editor.tf.select({
				anchor: { path: [0, 0], offset: 0 },
				focus: { path: [0, 0], offset: 1 },
			});
			await Promise.resolve();
		});
		expect(onChange).toHaveBeenCalledTimes(callsAfterBold);
		expect(screen.getByRole("button", { name: "太字" })).toHaveAttribute(
			"aria-pressed",
			"false",
		);

		await act(async () => {
			editor.tf.select({
				anchor: { path: [0, 1], offset: 0 },
				focus: { path: [0, 1], offset: 3 },
			});
			await Promise.resolve();
		});
		await user.click(screen.getByRole("button", { name: "斜体" }));

		const bothMarks = onChange.mock.calls.at(-1)?.[0] as Value;
		expect(bothMarks[0]?.children).toEqual([
			{ text: "h" },
			{ text: "ell", bold: true, italic: true },
			{ text: "o" },
		]);
		expect(container.querySelector("em")).toHaveTextContent("ell");

		await user.click(screen.getByRole("button", { name: "太字" }));
		const italicOnly = onChange.mock.calls.at(-1)?.[0] as Value;
		expect(italicOnly[0]?.children).toEqual([
			{ text: "h" },
			{ text: "ell", italic: true },
			{ text: "o" },
		]);
		expect(container.querySelector("strong")).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "斜体" }));
		const plain = onChange.mock.calls.at(-1)?.[0] as Value;
		expect(plain[0]?.children).toEqual([{ text: "hello" }]);
		expectSavableContent(plain);
		expect(container.querySelector("em")).not.toBeInTheDocument();
	});

	it("keeps focus in the editor after formatting so typing can continue", async () => {
		const user = userEvent.setup();
		const { container, onChange } = renderEditor({
			initialValue: [{ type: "p", children: [{ text: "hello" }] }],
		});
		const editor = editorFrom(container);
		const textbox = screen.getByRole("textbox", { name: "本文" });
		act(() => {
			textbox.focus();
			editor.tf.select({
				anchor: { path: [0, 0], offset: 5 },
				focus: { path: [0, 0], offset: 5 },
			});
			const range = editor.selection
				? editor.api.toDOMRange(editor.selection)
				: undefined;
			const selection = window.getSelection();
			if (range && selection) {
				selection.removeAllRanges();
				selection.addRange(range);
			}
		});

		await user.click(screen.getByRole("button", { name: "見出し1" }));

		expect(textbox).toHaveFocus();
		await insertText(editor, "!");
		expect(textOf(onChange.mock.calls.at(-1)?.[0] as Value)).toContain(
			"hello!",
		);
	});

	it("does not mix the previous page into the next page initial value", async () => {
		const { container, onChange, rerender } = renderEditor();
		const editor = editorFrom(container);
		await selectRange(editor, 0, 0);
		await insertText(editor, "hello");
		expect(screen.getByText("hello")).toBeVisible();
		const callsAfterType = onChange.mock.calls.length;

		const nextValue: Value = [{ type: "p", children: [{ text: "second" }] }];
		rerender(
			<PageEditor
				initialValue={nextValue}
				onChange={onChange}
				pageId="page-b"
			/>,
		);

		expect(screen.getByText("second")).toBeVisible();
		expect(screen.queryByText("hello")).not.toBeInTheDocument();
		expect(onChange).toHaveBeenCalledTimes(callsAfterType);
		expectSavableContent(onChange.mock.calls.at(-1)?.[0] as Value);
	});

	it("does not reset in-progress text when the parent rerenders", async () => {
		const { container, onChange, rerender } = renderEditor();
		const editor = editorFrom(container);
		await selectRange(editor, 0, 0);
		await insertText(editor, "hello");

		rerender(
			<PageEditor
				initialValue={[{ type: "p", children: [{ text: "" }] }]}
				onChange={vi.fn()}
				pageId="page-a"
			/>,
		);

		expect(screen.getByText("hello")).toBeVisible();
		expect(onChange).toHaveBeenCalledTimes(1);

		const nextOnChange = vi.fn();
		rerender(
			<PageEditor
				initialValue={emptyValue}
				onChange={nextOnChange}
				pageId="page-a"
			/>,
		);
		const nextEditor = editorFrom(container);
		await insertText(nextEditor, "!");
		expect(textOf(nextOnChange.mock.calls.at(-1)?.[0] as Value)).toContain(
			"hello!",
		);
	});

	it("rejects invalid initial values and does not report a replacement document", () => {
		const onChange = vi.fn();
		const invalidValues = [
			{ value: { type: "p" }, message: /must be an array/ },
			{ value: [], message: /must not be empty/ },
			{
				value: [{ type: "p" }],
				message: /node without children/,
			},
			{
				value: [{ type: "p", children: [] }],
				message: /node without children/,
			},
			{
				value: [{ type: "p", children: [{ type: "p" }] }],
				message: /node without children/,
			},
		];

		for (const invalid of invalidValues) {
			onChange.mockClear();
			expect(() =>
				render(
					<PageEditor
						initialValue={invalid.value as Value}
						onChange={onChange}
						pageId="page-a"
					/>,
				),
			).toThrow(invalid.message);
			expect(onChange).not.toHaveBeenCalled();
		}
	});

	it("ignores formatting buttons when the editor has no selection", async () => {
		const user = userEvent.setup();
		const { onChange } = renderEditor({
			initialValue: [{ type: "p", children: [{ text: "hello" }] }],
		});

		await user.click(screen.getByRole("button", { name: "見出し1" }));
		await user.click(screen.getByRole("button", { name: "太字" }));
		await user.click(screen.getByRole("button", { name: "斜体" }));

		expect(onChange).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "見出し1" })).toHaveAttribute(
			"aria-pressed",
			"false",
		);
	});

	it("blocks typing and formatting while read only", async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(
			<PageEditor
				initialValue={[{ type: "p", children: [{ text: "hello" }] }]}
				onChange={onChange}
				pageId="page-a"
				readOnly
			/>,
		);

		expect(screen.getByLabelText("本文")).toHaveAttribute(
			"contenteditable",
			"false",
		);
		for (const name of ["段落", "見出し1", "見出し2", "太字", "斜体"]) {
			expect(screen.getByRole("button", { name })).toBeDisabled();
		}
		await user.click(screen.getByRole("button", { name: "見出し1" }));
		expect(onChange).not.toHaveBeenCalled();
	});

	it("does not emit a change when the current block is selected again", async () => {
		const user = userEvent.setup();
		const { container, onChange } = renderEditor({
			initialValue: [{ type: "h1", children: [{ text: "hello" }] }],
		});
		await selectRange(editorFrom(container), 0, 5);
		expect(screen.getByRole("button", { name: "見出し1" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(onChange).not.toHaveBeenCalled();

		await user.click(screen.getByRole("button", { name: "見出し1" }));

		expect(onChange).not.toHaveBeenCalled();
		expect(
			screen.getByRole("heading", { level: 1, name: "hello" }),
		).toBeVisible();
	});
});

it("keeps an empty filtered menu safe for both arrow keys and Enter", async () => {
	const user = userEvent.setup();
	const { container, onChange } = renderEditor();
	const editor = editorFrom(container);
	await selectRange(editor, 0, 0);
	await insertText(editor, "/");
	const search = await screen.findByRole("textbox", { name: "ブロックを検索" });
	fireEvent.change(search, { target: { value: "no-match" } });
	await user.keyboard("{ArrowDown}{ArrowUp}{Enter}");
	expect(screen.queryByRole("option")).not.toBeInTheDocument();
	expect(onChange).not.toHaveBeenCalled();
	await user.keyboard("{Escape}");
	expect(
		screen.queryByRole("textbox", { name: "ブロックを検索" }),
	).not.toBeInTheDocument();
});
it("synchronizes a native expanded DOM range before changing every block", async () => {
	const user = userEvent.setup();
	const { container, onChange } = renderEditor({
		initialValue: [
			{ type: "p", children: [{ text: "first" }] },
			{ type: "p", children: [{ text: "second" }] },
		],
	});
	const editor = editorFrom(container);
	await selectRange(editor, 0, 0);
	const range = editor.api.toDOMRange({
		anchor: { path: [0, 0], offset: 0 },
		focus: { path: [1, 0], offset: 6 },
	});
	expect(range).toBeDefined();
	act(() => {
		const selection = window.getSelection();
		selection?.removeAllRanges();
		if (range) selection?.addRange(range);
	});
	await user.click(screen.getByRole("button", { name: "見出し2" }));
	expect(
		(onChange.mock.calls.at(-1)?.[0] as Value).map((block) => block.type),
	).toEqual(["h2", "h2"]);
});

it("does not publish programmatic content changes while the page is locked", async () => {
	const changed = vi.fn();
	const view = render(
		<PageEditor
			pageId="locked"
			initialValue={emptyValue}
			readOnly
			onChange={changed}
		/>,
	);
	const editor = editorFrom(view.container);
	await selectRange(editor, 0, 0);
	await insertText(editor, "retained internally");
	expect(changed).not.toHaveBeenCalled();
	expect(screen.getByRole("button", { name: "見出し1" })).toBeDisabled();
});

it("opens a slash command only for a collapsed cursor at the start of an empty paragraph", async () => {
	const { container } = renderEditor({
		initialValue: [
			{ type: "p", children: [{ text: "" }] },
			{ type: "p", children: [{ text: "other" }] },
		],
	});
	const editor = editorFrom(container);
	const trigger = editor.getOptions(SlashPlugin).triggerQuery as unknown as (
		editor: PlateEditor,
	) => boolean;
	expect(typeof trigger).toBe("function");
	await selectRange(editor, 0, 0);
	expect(trigger(editor)).toBe(true);
	act(() =>
		editor.tf.select({
			anchor: { path: [0, 0], offset: 0 },
			focus: { path: [1, 0], offset: 0 },
		}),
	);
	expect(trigger(editor)).toBe(false);
	act(() =>
		editor.tf.select({
			anchor: { path: [1, 0], offset: 0 },
			focus: { path: [1, 0], offset: 2 },
		}),
	);
	expect(trigger(editor)).toBe(false);
	act(() => editor.tf.deselect());
	expect(trigger(editor)).toBe(false);
});

it("preserves its known selection when a transient DOM range cannot be mapped", async () => {
	const user = userEvent.setup();
	const { container, onChange } = renderEditor({
		initialValue: [{ type: "p", children: [{ text: "retained" }] }],
	});
	const editor = editorFrom(container);
	await selectRange(editor, 0, 8);
	const range = editor.api.toDOMRange({
		anchor: { path: [0, 0], offset: 0 },
		focus: { path: [0, 0], offset: 8 },
	});
	act(() => {
		const selection = window.getSelection();
		selection?.removeAllRanges();
		if (range) selection?.addRange(range);
	});
	const spy = vi.spyOn(editor.api, "toSlateRange").mockReturnValue(undefined);
	await user.click(screen.getByRole("button", { name: "見出し1" }));
	expect((onChange.mock.calls.at(-1)?.[0] as Value)[0]).toMatchObject({
		type: "h1",
		children: [{ text: "retained" }],
	});
	spy.mockRestore();
});
