import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PageDuplicateDialog } from "./page-duplicate-dialog";

describe("PageDuplicateDialog", () => {
	it("traps keyboard focus, cancels on Escape, and restores the opener", async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();
		const opener = document.createElement("button");
		opener.textContent = "open duplicate";
		document.body.append(opener);
		opener.focus();
		const view = render(
			<PageDuplicateDialog
				error={null}
				onCancel={onCancel}
				onConfirm={vi.fn()}
				pending={false}
				title="メモ"
			/>,
		);
		const dialog = screen.getByRole("dialog", {
			name: "「メモ」を複製しますか",
		});
		const cancel = screen.getByRole("button", { name: "キャンセル" });
		const confirm = screen.getByRole("button", { name: "複製する" });
		expect(cancel).toHaveFocus();
		await user.tab({ shift: true });
		expect(confirm).toHaveFocus();
		await user.keyboard("{Escape}");
		expect(onCancel).toHaveBeenCalledOnce();
		view.unmount();
		expect(opener).toHaveFocus();
		opener.remove();
		expect(dialog).not.toBeInTheDocument();
	});

	it("keeps submission and cancellation unavailable while pending", async () => {
		const onCancel = vi.fn();
		render(
			<PageDuplicateDialog
				error={null}
				onCancel={onCancel}
				onConfirm={vi.fn()}
				pending
				title="メモ"
			/>,
		);
		expect(screen.getByRole("button", { name: "複製中" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
		await act(async () => {
			window.dispatchEvent(
				new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
			);
		});
		expect(onCancel).not.toHaveBeenCalled();
	});
});

it("handles an error refresh and keyboard movement from outside the dialog", async () => {
	const user = userEvent.setup();
	const refresh = vi.fn();
	const confirm = vi.fn();
	const opener = document.createElement("button");
	document.body.append(opener);
	const view = render(
		<PageDuplicateDialog
			title="Source"
			pending={false}
			error="Conflict"
			onRefresh={refresh}
			onConfirm={confirm}
			onCancel={vi.fn()}
		/>,
	);
	expect(screen.getByRole("alert")).toHaveTextContent("Conflict");
	await user.click(screen.getByRole("button", { name: "最新の状態を取得" }));
	expect(refresh).toHaveBeenCalledOnce();
	await user.click(screen.getByRole("button", { name: "再試行" }));
	expect(confirm).toHaveBeenCalledOnce();
	opener.focus();
	await user.tab();
	expect(
		screen.getByRole("button", { name: "最新の状態を取得" }),
	).toHaveFocus();
	opener.focus();
	await user.tab({ shift: true });
	expect(screen.getByRole("button", { name: "キャンセル" })).toHaveFocus();
	await user.tab();
	expect(
		screen.getByRole("button", { name: "最新の状態を取得" }),
	).toHaveFocus();
	view.rerender(
		<PageDuplicateDialog
			title="Source"
			pending
			error={null}
			onConfirm={confirm}
			onCancel={vi.fn()}
		/>,
	);
	opener.focus();
	fireEvent.keyDown(document, { key: "Tab" });
	expect(screen.getByRole("dialog")).toHaveFocus();
	view.unmount();
	opener.remove();
});
