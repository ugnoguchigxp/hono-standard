import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PageSummary } from "../api";
import { PageMoveDialog, pageMoveOptions } from "./page-move-dialog";

const pages: PageSummary[] = [
	{ id: "root-a", parentId: null, title: "Root", createdAt: "", updatedAt: "" },
	{
		id: "source",
		parentId: "root-a",
		title: "Source",
		createdAt: "",
		updatedAt: "",
	},
	{
		id: "child",
		parentId: "source",
		title: "Child",
		createdAt: "",
		updatedAt: "",
	},
	{ id: "root-b", parentId: null, title: "Root", createdAt: "", updatedAt: "" },
];

describe("page move dialog", () => {
	it("excludes itself and descendants and uses paths plus ids for duplicate labels", () => {
		const result = pageMoveOptions(pages, "source");
		expect(result.error).toBeNull();
		expect(result.options.map(({ id, label }) => [id, label])).toEqual([
			["root-a", "Root (root-a)"],
			["root-b", "Root (root-b)"],
		]);
	});

	it("detects malformed cyclic trees instead of walking indefinitely", () => {
		const cyclic = pages.map((page) =>
			page.id === "root-a" ? { ...page, parentId: "child" } : page,
		);
		expect(pageMoveOptions(cyclic, "source").error).toMatch(/循環/);
		const missingParent = pages.map((page) =>
			page.id === "root-a" ? { ...page, parentId: "missing" } : page,
		);
		expect(pageMoveOptions(missingParent, "source").error).toMatch(
			/確認できない/,
		);
	});

	it("requires a new destination and reports the selected UUID", async () => {
		const user = userEvent.setup();
		const onMove = vi.fn();
		render(
			<PageMoveDialog
				busy={false}
				currentParentId="root-a"
				error={null}
				onCancel={vi.fn()}
				onMove={onMove}
				pageId="source"
				pageTitle="Source"
				pages={pages}
			/>,
		);
		expect(screen.getByRole("button", { name: "移動する" })).toBeDisabled();
		await user.selectOptions(screen.getByLabelText("移動先"), "root-b");
		await user.click(screen.getByRole("button", { name: "移動する" }));
		expect(onMove).toHaveBeenCalledWith("root-b");
	});

	it("moves a page to the root when the root option is selected", async () => {
		const user = userEvent.setup();
		const onMove = vi.fn();
		render(
			<PageMoveDialog
				busy={false}
				currentParentId="root-a"
				error={null}
				onCancel={vi.fn()}
				onMove={onMove}
				pageId="source"
				pageTitle="Source"
				pages={pages}
			/>,
		);
		await user.selectOptions(screen.getByLabelText("移動先"), "__page_root__");
		await user.click(screen.getByRole("button", { name: "移動する" }));
		expect(onMove).toHaveBeenCalledWith(null);
	});

	it("traps focus, restores it on close, and lets Escape cancel", async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();
		const trigger = document.createElement("button");
		trigger.textContent = "Open mover";
		document.body.append(trigger);
		trigger.focus();
		const view = render(
			<PageMoveDialog
				busy={false}
				currentParentId="root-a"
				error={null}
				onCancel={onCancel}
				onMove={vi.fn()}
				pageId="source"
				pageTitle="Source"
				pages={pages}
			/>,
		);
		const select = screen.getByLabelText("移動先");
		await user.selectOptions(select, "root-b");
		const moveButton = screen.getByRole("button", { name: "移動する" });
		expect(select).toHaveFocus();
		fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
		expect(moveButton).toHaveFocus();
		fireEvent.keyDown(document, { key: "Tab" });
		expect(select).toHaveFocus();
		fireEvent.keyDown(document, { key: "Escape" });
		expect(onCancel).toHaveBeenCalledOnce();
		await user.click(screen.getByRole("button", { name: "キャンセル" }));
		view.unmount();
		expect(trigger).toHaveFocus();
		trigger.remove();
	});

	it("requires a state check after uncertain outcomes and respects the busy state", async () => {
		const user = userEvent.setup();
		const onCheckState = vi.fn();
		render(
			<PageMoveDialog
				busy={false}
				currentParentId={null}
				error="移動結果を確認できませんでした"
				onCancel={vi.fn()}
				onCheckState={onCheckState}
				onMove={vi.fn()}
				pageId="source"
				pageTitle="Source"
				pages={pages}
				requiresCheck
			/>,
		);
		const move = screen.getByRole("button", { name: "移動する" });
		expect(move).toBeDisabled();
		await user.click(screen.getByRole("button", { name: "状態を確認" }));
		expect(onCheckState).toHaveBeenCalledOnce();
	});

	it("moves focus back into the dialog when focus escapes", () => {
		const outside = document.createElement("button");
		document.body.append(outside);
		const view = render(
			<PageMoveDialog
				busy={false}
				currentParentId={null}
				error={null}
				onCancel={vi.fn()}
				onMove={vi.fn()}
				pageId="source"
				pageTitle="Source"
				pages={pages}
			/>,
		);
		outside.focus();
		fireEvent.keyDown(document, { key: "Tab" });
		expect(screen.getByLabelText("移動先")).toHaveFocus();
		view.unmount();
		outside.remove();
	});

	it("does not cancel on Escape while a move is busy", () => {
		const onCancel = vi.fn();
		render(
			<PageMoveDialog
				busy
				currentParentId={null}
				error={null}
				onCancel={onCancel}
				onMove={vi.fn()}
				pageId="source"
				pageTitle="Source"
				pages={pages}
			/>,
		);
		fireEvent.keyDown(document, { key: "Escape" });
		expect(onCancel).not.toHaveBeenCalled();
	});
});

it("recaptures keyboard focus from an external element and blocks Escape while moving", async () => {
	const user = userEvent.setup();
	const cancel = vi.fn();
	const opener = document.createElement("button");
	document.body.append(opener);
	const view = render(
		<PageMoveDialog
			pages={pages}
			pageId="source"
			pageTitle="Source"
			currentParentId="root-a"
			busy={false}
			error={null}
			onMove={vi.fn()}
			onCancel={cancel}
		/>,
	);
	opener.focus();
	await user.tab();
	expect(screen.getByLabelText("移動先")).toHaveFocus();
	view.rerender(
		<PageMoveDialog
			pages={pages}
			pageId="source"
			pageTitle="Source"
			currentParentId="root-a"
			busy
			error={null}
			onMove={vi.fn()}
			onCancel={cancel}
		/>,
	);
	await user.keyboard("{Escape}");
	expect(cancel).not.toHaveBeenCalled();
	view.unmount();
	opener.remove();
});
