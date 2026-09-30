import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PageSummary } from "../api";

const ROOT = "__page_root__";

export function pageMoveOptions(
	pages: readonly PageSummary[],
	pageId: string,
): { options: Array<{ id: string; label: string }>; error: string | null } {
	const byId = new Map(pages.map((page) => [page.id, page]));
	const candidates: Array<{ id: string; label: string }> = [];
	for (const candidate of pages) {
		if (candidate.id === pageId) continue;
		const visited = new Set<string>();
		const segments: string[] = [];
		let cursor: PageSummary | undefined = candidate;
		let isDescendant = false;
		while (cursor) {
			if (visited.has(cursor.id)) {
				return {
					options: [],
					error: "ページ階層に循環があるため移動できません",
				};
			}
			visited.add(cursor.id);
			if (cursor.id === pageId) isDescendant = true;
			segments.unshift(cursor.title);
			if (cursor.parentId === null) break;
			cursor = byId.get(cursor.parentId);
			if (!cursor) {
				return {
					options: [],
					error: "ページ階層を確認できないため移動できません",
				};
			}
		}
		if (!isDescendant)
			candidates.push({ id: candidate.id, label: segments.join(" › ") });
	}
	const labelCounts = new Map<string, number>();
	for (const item of candidates) {
		labelCounts.set(item.label, (labelCounts.get(item.label) ?? 0) + 1);
	}
	return {
		options: candidates.map((item) => ({
			...item,
			label:
				(labelCounts.get(item.label) ?? 0) > 1
					? `${item.label} (${item.id.slice(0, 8)})`
					: item.label,
		})),
		error: null,
	};
}

export function PageMoveDialog({
	pageTitle,
	pageId,
	currentParentId,
	pages,
	busy,
	error,
	requiresCheck = false,
	onMove,
	onCancel,
	onCheckState,
}: {
	pageTitle: string;
	pageId: string;
	currentParentId: string | null;
	pages: readonly PageSummary[];
	busy: boolean;
	error: string | null;
	requiresCheck?: boolean;
	onMove: (parentId: string | null) => void;
	onCancel: () => void;
	onCheckState?: () => void;
}) {
	const dialogRef = useRef<HTMLDivElement>(null);
	const selectRef = useRef<HTMLSelectElement>(null);
	const cancelRef = useRef<HTMLButtonElement>(null);
	const onCancelRef = useRef(onCancel);
	onCancelRef.current = onCancel;
	const [selected, setSelected] = useState(currentParentId ?? ROOT);
	useEffect(() => setSelected(currentParentId ?? ROOT), [currentParentId]);
	const { options, error: hierarchyError } = pageMoveOptions(pages, pageId);
	const selectionSame =
		(selected === ROOT ? null : selected) === currentParentId;

	useLayoutEffect(() => {
		const previousFocus =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		selectRef.current?.focus();
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !busy) {
				event.preventDefault();
				onCancelRef.current();
				return;
			}
			if (event.key !== "Tab") return;
			const dialog = dialogRef.current;
			if (!dialog) return;
			const focusable = Array.from(
				dialog.querySelectorAll<HTMLElement>(
					'button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
				),
			);
			const first = focusable[0];
			const last = focusable.at(-1);
			if (!dialog.contains(document.activeElement)) {
				event.preventDefault();
				first?.focus();
			} else if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last?.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first?.focus();
			}
		};
		document.addEventListener("keydown", handleKeyDown, true);
		return () => {
			document.removeEventListener("keydown", handleKeyDown, true);
			previousFocus?.focus();
		};
	}, [busy]);

	return (
		<div className="page-move-backdrop">
			<div
				aria-labelledby="page-move-title"
				aria-modal="true"
				className="page-move-dialog"
				ref={dialogRef}
				role="dialog"
				tabIndex={-1}
			>
				<h2 id="page-move-title">ページを移動</h2>
				<p>「{pageTitle}」の移動先を選択してください。</p>
				<label htmlFor="page-move-destination">移動先</label>
				<select
					disabled={busy || Boolean(hierarchyError)}
					id="page-move-destination"
					ref={selectRef}
					value={selected}
					onChange={(event) => setSelected(event.target.value)}
				>
					<option value={ROOT}>最上位</option>
					{options.map((option) => (
						<option key={option.id} value={option.id}>
							{option.label}
						</option>
					))}
				</select>
				<p className="muted">
					現在の親:{" "}
					{currentParentId
						? (pages.find((p) => p.id === currentParentId)?.title ?? "不明")
						: "最上位"}
				</p>
				{hierarchyError || error ? (
					<p className="pages-error" role="alert">
						{hierarchyError ?? error}
					</p>
				) : null}
				{requiresCheck && onCheckState ? (
					<button
						className="auth-open-button"
						disabled={busy}
						onClick={onCheckState}
						type="button"
					>
						状態を確認
					</button>
				) : null}
				<div className="page-move-actions">
					<button
						className="auth-open-button"
						disabled={busy}
						onClick={() => onCancelRef.current()}
						ref={cancelRef}
						type="button"
					>
						キャンセル
					</button>
					<button
						className="auth-open-button"
						disabled={
							busy || requiresCheck || selectionSame || Boolean(hierarchyError)
						}
						onClick={() => onMove(selected === ROOT ? null : selected)}
						type="button"
					>
						{busy ? "移動中…" : "移動する"}
					</button>
				</div>
			</div>
		</div>
	);
}
