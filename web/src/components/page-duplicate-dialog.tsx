import { useLayoutEffect, useRef } from "react";

export function PageDuplicateDialog({
	title,
	pending,
	error,
	onRefresh,
	onConfirm,
	onCancel,
}: {
	title: string;
	pending: boolean;
	error: string | null;
	onRefresh?: (() => void) | null;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	const dialogRef = useRef<HTMLDivElement>(null);
	const cancelRef = useRef<HTMLButtonElement>(null);
	const cancelAction = useRef(onCancel);
	const pendingRef = useRef(pending);
	cancelAction.current = onCancel;
	pendingRef.current = pending;

	useLayoutEffect(() => {
		const previousFocus =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		cancelRef.current?.focus();
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				if (!pendingRef.current) cancelAction.current();
				return;
			}
			if (event.key !== "Tab") return;
			const dialog = dialogRef.current;
			if (!dialog) return;
			const controls = Array.from(
				dialog.querySelectorAll<HTMLElement>("button:not([disabled])"),
			);
			event.preventDefault();
			if (controls.length === 0) {
				dialog.focus();
				return;
			}
			const index = controls.findIndex(
				(element) => element === document.activeElement,
			);
			const next = event.shiftKey
				? index <= 0
					? controls.length - 1
					: index - 1
				: (index + 1) % controls.length;
			controls[next]?.focus();
		};
		document.addEventListener("keydown", handleKeyDown, true);
		return () => {
			document.removeEventListener("keydown", handleKeyDown, true);
			if (previousFocus?.isConnected) previousFocus.focus();
		};
	}, []);

	useLayoutEffect(() => {
		if (pending && !dialogRef.current?.contains(document.activeElement)) {
			dialogRef.current?.focus();
		}
	}, [pending]);

	return (
		<div
			aria-labelledby="page-duplicate-title"
			aria-modal="true"
			className="page-confirm"
			ref={dialogRef}
			role="dialog"
			tabIndex={-1}
		>
			<div className="page-confirm-panel">
				<h2 id="page-duplicate-title">「{title}」を複製しますか</h2>
				<p>
					このページのタイトルと保存済み本文を複製します。子ページは含みません。
				</p>
				{error ? (
					<p className="pages-error" role="alert">
						{error}
					</p>
				) : null}
				{error && onRefresh ? (
					<button
						className="auth-open-button"
						onClick={onRefresh}
						type="button"
					>
						最新の状態を取得
					</button>
				) : null}
				<div className="page-confirm-actions">
					<button
						className="auth-open-button"
						disabled={pending}
						onClick={onConfirm}
						type="button"
					>
						{pending ? "複製中" : error ? "再試行" : "複製する"}
					</button>
					<button
						className="auth-open-button"
						disabled={pending}
						onClick={onCancel}
						ref={cancelRef}
						type="button"
					>
						キャンセル
					</button>
				</div>
			</div>
		</div>
	);
}
