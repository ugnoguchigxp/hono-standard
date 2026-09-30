import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PageEditGuardProvider, PageLeaveDialog } from "./page-edit-guard";

function DialogHost({ onConfirm }: { onConfirm: () => void }) {
	const [open, setOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	useEffect(() => {
		const markSaving = () => setSaving(true);
		window.addEventListener("test-save-start", markSaving);
		return () => window.removeEventListener("test-save-start", markSaving);
	}, []);
	return (
		<PageEditGuardProvider>
			<button onClick={() => setOpen(true)} type="button">
				ページを離れる
			</button>
			{open ? (
				<PageLeaveDialog
					confirmDisabled={saving}
					confirmLabel="破棄して離れる"
					onCancel={() => setOpen(false)}
					onConfirm={onConfirm}
					title="未保存の変更を破棄しますか"
					titleId="leave-title"
				/>
			) : null}
		</PageEditGuardProvider>
	);
}

describe("PageLeaveDialog interactions", () => {
	it("traps Tab focus, returns focus on Escape, and disables discard if saving starts", async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		render(<DialogHost onConfirm={onConfirm} />);

		await user.click(screen.getByRole("button", { name: "ページを離れる" }));
		const confirm = screen.getByRole("button", { name: "破棄して離れる" });
		const cancel = screen.getByRole("button", { name: "戻る" });
		expect(cancel).toHaveFocus();

		await user.tab();
		expect(confirm).toHaveFocus();
		await user.tab();
		expect(cancel).toHaveFocus();
		await user.tab({ shift: true });
		expect(confirm).toHaveFocus();

		fireEvent(window, new Event("test-save-start"));
		expect(confirm).toBeDisabled();
		fireEvent.click(confirm);
		expect(onConfirm).not.toHaveBeenCalled();

		await user.keyboard("{Escape}");
		expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "ページを離れる" }),
		).toHaveFocus();
	});
});

it("keeps keyboard focus inside the dialog even when focus was moved outside", async () => {
	const user = userEvent.setup();
	render(<DialogHost onConfirm={vi.fn()} />);
	const opener = screen.getByRole("button", { name: "ページを離れる" });
	await user.click(opener);
	opener.focus();
	await user.tab();
	expect(screen.getByRole("button", { name: "破棄して離れる" })).toHaveFocus();
	opener.focus();
	await user.tab({ shift: true });
	expect(screen.getByRole("button", { name: "戻る" })).toHaveFocus();
	const dialog = screen.getByRole("alertdialog");
	for (const button of dialog.querySelectorAll("button"))
		button.disabled = true;
	fireEvent.keyDown(document, { key: "Tab" });
	expect(dialog).toHaveFocus();
});
