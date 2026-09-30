import {
	BoldPlugin,
	H1Plugin,
	H2Plugin,
	ItalicPlugin,
} from "@platejs/basic-nodes/react";
import { SlashInputPlugin, SlashPlugin } from "@platejs/slash-command/react";
import type { Value } from "platejs";
import {
	ParagraphPlugin,
	Plate,
	PlateContent,
	type PlateEditor,
	PlateElement,
	type PlateElementProps,
	useEditorRef,
	useEditorSelector,
	usePlateEditor,
} from "platejs/react";
import {
	type ChangeEvent,
	type MouseEvent,
	type KeyboardEvent,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { usePageEditorAutosaveHold } from "../page-edit-guard";

type PageEditorProps = {
	pageId: string;
	initialValue: Value;
	onChange: (value: Value) => void;
	readOnly?: boolean;
	disabled?: boolean;
};

const BLOCK_BUTTONS = [
	{ type: "p", label: "段落" },
	{ type: "h1", label: "見出し1" },
	{ type: "h2", label: "見出し2" },
] as const;

type BlockType = (typeof BLOCK_BUTTONS)[number]["type"];

const MARK_BUTTONS = [
	{ type: "bold", label: "太字" },
	{ type: "italic", label: "斜体" },
] as const;

const SLASH_MENU_ITEMS = [
	{ type: "p", label: "段落", search: ["p", "paragraph"] },
	{
		type: "h1",
		label: "見出し1",
		search: ["h", "h1", "heading 1", "heading1"],
	},
	{
		type: "h2",
		label: "見出し2",
		search: ["h", "h2", "heading 2", "heading2"],
	},
] as const;

type MarkType = (typeof MARK_BUTTONS)[number]["type"];

type MarkEditor = PlateEditor & {
	tf: PlateEditor["tf"] & Record<MarkType, { toggle: () => void }>;
};

export function PageEditor({
	pageId,
	initialValue,
	onChange,
	readOnly = false,
	disabled = false,
}: PageEditorProps) {
	assertPageEditorValue(initialValue);
	return (
		<PageEditorSession
			key={pageId}
			pageId={pageId}
			initialValue={initialValue}
			onChange={onChange}
			readOnly={readOnly}
			disabled={disabled}
		/>
	);
}

function PageEditorSession({
	pageId,
	initialValue,
	onChange,
	readOnly = false,
	disabled = false,
}: PageEditorProps) {
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const readOnlyRef = useRef(readOnly);
	readOnlyRef.current = readOnly;
	const setSlashHold = usePageEditorAutosaveHold();
	const editor = usePlateEditor({
		id: pageId,
		plugins: [
			ParagraphPlugin.withComponent(ParagraphElement),
			BoldPlugin,
			ItalicPlugin,
			H1Plugin.withComponent(H1Element),
			H2Plugin.withComponent(H2Element),
			SlashPlugin.configure({
				options: {
					triggerQuery: onlyEmptyParagraphAtStart,
				},
			}),
			SlashInputPlugin.withComponent(SlashInputElement),
		],
		value: initialValue,
	});
	const handleValueChange = useCallback(
		({ value }: { value: Value }) => {
			const hasSlashInput = containsSlashInput(value);
			setSlashHold(hasSlashInput);
			if (hasSlashInput) return;
			if (readOnlyRef.current) return;
			onChangeRef.current(structuredClone(value));
		},
		[setSlashHold],
	);
	useEffect(() => () => setSlashHold(false), [setSlashHold]);

	return (
		<Plate editor={editor} onValueChange={handleValueChange}>
			<div className="page-editor">
				<PageEditorToolbar readOnly={readOnly || disabled} />
				<PlateContent
					aria-label="本文"
					className="page-editor-content"
					readOnly={readOnly || disabled}
				/>
			</div>
		</Plate>
	);
}

function PageEditorToolbar({ readOnly }: { readOnly: boolean }) {
	const editor = useEditorRef() as MarkEditor;
	const blockType = useEditorSelector(currentBlockType, []);
	const bold = useEditorSelector(
		(current) => current.api.marks()?.bold === true,
		[],
	);
	const italic = useEditorSelector(
		(current) => current.api.marks()?.italic === true,
		[],
	);
	const pressedMark = { bold, italic };

	return (
		<div aria-label="書式" className="page-editor-toolbar" role="toolbar">
			{BLOCK_BUTTONS.map((button) => (
				<button
					aria-pressed={blockType === button.type}
					disabled={readOnly}
					key={button.type}
					onClick={() => applyBlockType(editor, button.type)}
					onMouseDown={keepEditorFocus}
					type="button"
				>
					{button.label}
				</button>
			))}
			{MARK_BUTTONS.map((button) => (
				<button
					aria-pressed={pressedMark[button.type]}
					disabled={readOnly}
					key={button.type}
					onClick={() => applyMark(editor, button.type)}
					onMouseDown={keepEditorFocus}
					type="button"
				>
					{button.label}
				</button>
			))}
		</div>
	);
}

function ParagraphElement(props: PlateElementProps) {
	return <PlateElement {...props} as="p" />;
}

function H1Element(props: PlateElementProps) {
	return <PlateElement {...props} as="h1" />;
}

function H2Element(props: PlateElementProps) {
	return <PlateElement {...props} as="h2" />;
}

function SlashInputElement(props: PlateElementProps) {
	const editor = useEditorRef();
	const inputRef = useRef<HTMLInputElement>(null);
	const menuId = useId();
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const items = SLASH_MENU_ITEMS.filter((item) => {
		const search = query.trim().toLocaleLowerCase();
		if (!search) return true;
		return [item.label, ...item.search].some((term) =>
			term.toLocaleLowerCase().startsWith(search),
		);
	});

	useEffect(() => {
		inputRef.current?.focus();
	}, []);
	useEffect(() => {
		setActiveIndex((index) => Math.min(index, Math.max(items.length - 1, 0)));
	}, [items.length]);

	const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
		setQuery(event.currentTarget.value);
		setActiveIndex(0);
	};
	const cancel = () => finishSlashInput(editor, null);
	const choose = (type: BlockType) => finishSlashInput(editor, type);
	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActiveIndex((index) =>
				items.length ? (index + 1) % items.length : 0,
			);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex((index) =>
				items.length ? (index - 1 + items.length) % items.length : 0,
			);
		} else if (event.key === "Enter" && items[activeIndex]) {
			event.preventDefault();
			choose(items[activeIndex].type);
		} else if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			cancel();
		}
	};

	return (
		<PlateElement {...props} as="span">
			<span
				contentEditable={false}
				data-testid="page-editor-slash-menu"
				style={{ display: "inline-block", position: "relative" }}
			>
				<span aria-hidden="true">/</span>
				<input
					aria-activedescendant={
						items[activeIndex]
							? `${menuId}-${items[activeIndex].type}`
							: undefined
					}
					aria-controls={menuId}
					aria-label="ブロックを検索"
					autoComplete="off"
					onChange={handleQueryChange}
					onKeyDown={handleKeyDown}
					ref={inputRef}
					value={query}
				/>
				<span
					aria-label="ブロック"
					id={menuId}
					role="listbox"
					style={{
						background: "white",
						border: "1px solid currentColor",
						left: 0,
						minWidth: "12rem",
						padding: "0.25rem",
						position: "absolute",
						top: "100%",
						zIndex: 10,
					}}
				>
					{items.map((item, index) => (
						<button
							aria-selected={index === activeIndex}
							id={`${menuId}-${item.type}`}
							key={item.type}
							onClick={() => choose(item.type)}
							onMouseDown={keepEditorFocus}
							role="option"
							style={{ display: "block", width: "100%" }}
							type="button"
						>
							{item.label}
						</button>
					))}
				</span>
			</span>
			{props.children}
		</PlateElement>
	);
}

function currentBlockType(editor: PlateEditor): BlockType | "" {
	const type = editor.api.block()?.[0]?.type;
	if (type === "h1" || type === "h2" || type === "p") return type;
	return "";
}

function syncDomSelection(editor: PlateEditor) {
	const selection = editor.api.getWindow()?.getSelection();
	const root = editor.api.toDOMNode(editor);
	if (
		selection?.isCollapsed ||
		!selection?.anchorNode ||
		!selection.focusNode ||
		!root?.contains(selection.anchorNode) ||
		!root.contains(selection.focusNode)
	)
		return;
	const range = editor.api.toSlateRange(selection, {
		exactMatch: false,
		suppressThrow: true,
	});
	if (range) editor.tf.select(range);
}

function applyBlockType(editor: PlateEditor, type: BlockType) {
	syncDomSelection(editor);
	if (!editor.selection) return;
	editor.tf.setNodes({ type }, { match: (node) => editor.api.isBlock(node) });
	editor.tf.focus();
}

function applyMark(editor: MarkEditor, type: MarkType) {
	if (!editor.selection) return;
	editor.tf[type].toggle();
	editor.tf.focus();
}

function keepEditorFocus(event: MouseEvent<HTMLButtonElement>) {
	event.preventDefault();
}

function onlyEmptyParagraphAtStart(editor: PlateEditor): boolean {
	const entry = editor.api.block();
	const selection = editor.selection;
	if (entry?.[0].type !== "p" || !selection) return false;
	if (
		selection.anchor.offset !== selection.focus.offset ||
		selection.anchor.path.some(
			(part, index) => part !== selection.focus.path[index],
		)
	) {
		return false;
	}
	if (
		selection.anchor.path.length !== 2 ||
		selection.anchor.path[0] !== entry[1][0] ||
		selection.anchor.path[1] !== 0
	) {
		return false;
	}
	return textContent(entry[0]) === "" && selection.anchor.offset === 0;
}

function textContent(node: unknown): string {
	if (!isRecord(node)) return "";
	if (typeof node.text === "string") return node.text;
	if (!Array.isArray(node.children)) return "";
	return node.children.map(textContent).join("");
}

function containsSlashInput(value: Value): boolean {
	return value.some((node) => containsNodeType(node, "slash_input"));
}

function containsNodeType(node: unknown, type: string): boolean {
	if (!isRecord(node)) return false;
	if (node.type === type) return true;
	return (
		Array.isArray(node.children) &&
		node.children.some((child) => containsNodeType(child, type))
	);
}

function finishSlashInput(editor: PlateEditor, type: BlockType | null): void {
	const blockIndex = editor.children.findIndex((block) =>
		containsNodeType(block, "slash_input"),
	);
	if (blockIndex < 0) return;
	const block = editor.children[blockIndex];
	if (!block || !Array.isArray((block as { children?: unknown }).children))
		return;
	const children = (block as { children: unknown[] }).children;
	const slashIndex = children.findIndex((child) =>
		containsNodeType(child, "slash_input"),
	);
	if (slashIndex < 0) return;
	if (type) editor.tf.setNodes({ type }, { at: [blockIndex] });
	editor.tf.removeNodes({ at: [blockIndex, slashIndex] });
	editor.tf.select({
		anchor: { path: [blockIndex, 0], offset: 0 },
		focus: { path: [blockIndex, 0], offset: 0 },
	});
	editor.tf.focus();
}

function assertPageEditorValue(value: unknown): asserts value is Value {
	if (!Array.isArray(value)) {
		throw new Error("PageEditor initialValue must be an array");
	}
	if (value.length === 0) {
		throw new Error("PageEditor initialValue must not be empty");
	}
	for (const node of value) assertElementNode(node);
}

function assertElementNode(node: unknown): void {
	if (
		!isRecord(node) ||
		!Array.isArray(node.children) ||
		node.children.length === 0
	) {
		throw new Error("PageEditor initialValue contains a node without children");
	}
	for (const child of node.children) {
		if (isTextLeaf(child)) continue;
		assertElementNode(child);
	}
}

function isTextLeaf(node: unknown): boolean {
	return isRecord(node) && typeof node.text === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
