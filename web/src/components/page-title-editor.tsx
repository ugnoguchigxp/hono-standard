import { pageTitleSchema } from "../../../shared/schemas/pages.schema";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HttpStatusError, useUpdatePageTitleMutation } from "../api";
import type { PageEditGuardState } from "../page-edit-guard";
import {
	clearPageDraftRecovery,
	clearPageDraftRecoveryIfVersion,
	pageDraftRecoveryVersion,
	readPageDraftRecovery,
	storePageDraftRecovery,
	storePageDraftRecoveryIfVersion,
} from "../page-draft-recovery";

export function PageTitleEditor({
	userId,
	pageId,
	title,
	onGuardChange,
	editingDisabled = false,
}: {
	userId: string;
	pageId: string;
	title: string;
	onGuardChange: (state: PageEditGuardState) => void;
	editingDisabled?: boolean;
}) {
	const mutation = useUpdatePageTitleMutation(userId, pageId);
	const [recoveredDraft, setRecoveredDraft] = useState(() =>
		readPageDraftRecovery(userId, pageId, "title"),
	);
	const [editing, setEditing] = useState(Boolean(recoveredDraft));
	const [draft, setDraft] = useState(recoveredDraft?.value ?? title);
	const [validationError, setValidationError] = useState<string | null>(null);
	const composing = useRef(false);
	const sending = useRef(false);
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);
	const parsed = pageTitleSchema.safeParse(draft);
	const unsaved = editing && (!parsed.success || parsed.data !== title);
	const saving = mutation.isPending;
	useLayoutEffect(() => {
		onGuardChange({ unsaved, saving });
	}, [unsaved, saving, onGuardChange]);
	const cancel = () => {
		if (sending.current) return;
		clearPageDraftRecovery(userId, pageId, "title");
		setRecoveredDraft(null);
		setEditing(false);
		setDraft(title);
		setValidationError(null);
		mutation.reset();
	};
	const save = async () => {
		if (sending.current || composing.current) return;
		const input = pageTitleSchema.safeParse(draft);
		if (!input.success) {
			setValidationError("タイトルは空白を除いて1〜200文字で入力してください");
			return;
		}
		if (input.data === title) {
			cancel();
			return;
		}
		setValidationError(null);
		sending.current = true;
		const recoveryVersion = pageDraftRecoveryVersion(userId, pageId, "title");
		try {
			await mutation.mutateAsync({ title: input.data });
			const cleared = clearPageDraftRecoveryIfVersion(
				userId,
				pageId,
				"title",
				recoveryVersion,
			);
			if (mounted.current) {
				if (cleared) setRecoveredDraft(null);
				setEditing(false);
			}
		} catch (error) {
			if (error instanceof HttpStatusError && error.status === 401) {
				storePageDraftRecoveryIfVersion(
					userId,
					pageId,
					{ kind: "title", value: draft },
					recoveryVersion,
				);
			}
			// Keep the draft; retry is explicitly requested by the user.
		} finally {
			sending.current = false;
		}
	};
	if (!editing)
		return (
			<div className="page-title-editor">
				<h1>{title}</h1>
				<button
					className="auth-open-button"
					disabled={editingDisabled}
					type="button"
					onClick={() => {
						clearPageDraftRecovery(userId, pageId, "title");
						setRecoveredDraft(null);
						setDraft(title);
						mutation.reset();
						setValidationError(null);
						setEditing(true);
					}}
				>
					タイトルを編集
				</button>
			</div>
		);
	const error =
		validationError ??
		(recoveredDraft
			? "セッションが切れました。再認証後にタイトルを再試行してください。"
			: mutation.isError
				? mutation.error instanceof HttpStatusError &&
					mutation.error.status === 404
					? "ページが見つかりません"
					: "タイトルを保存できませんでした"
				: null);
	return (
		<div className="page-title-editor">
			<label htmlFor="page-title-input">ページタイトル</label>
			<input
				id="page-title-input"
				className="page-title-input"
				disabled={saving || editingDisabled}
				value={draft}
				aria-invalid={Boolean(error)}
				aria-describedby={error ? "page-title-error" : undefined}
				onChange={(event) => {
					const value = event.target.value;
					setDraft(value);
					if (recoveredDraft) {
						storePageDraftRecovery(userId, pageId, {
							kind: "title",
							value,
						});
					}
					setValidationError(null);
				}}
				onCompositionStart={() => {
					composing.current = true;
				}}
				onCompositionEnd={() => {
					composing.current = false;
				}}
				onKeyDown={(event) => {
					if (
						composing.current ||
						event.nativeEvent.isComposing ||
						event.keyCode === 229
					)
						return;
					if (event.key === "Enter") {
						event.preventDefault();
						void save();
					}
					if (event.key === "Escape") {
						event.preventDefault();
						cancel();
					}
				}}
			/>
			<div className="page-save-bar">
				<button
					className="auth-open-button"
					type="button"
					disabled={saving || editingDisabled}
					onClick={() => void save()}
				>
					{mutation.isError || recoveredDraft ? "再試行" : "タイトルを保存"}
				</button>
				<button
					className="auth-open-button"
					type="button"
					disabled={saving || editingDisabled}
					onClick={cancel}
				>
					キャンセル
				</button>
				<p role="status">
					{saving
						? "タイトル保存中"
						: unsaved
							? "タイトル未保存"
							: "タイトル保存済み"}
				</p>
			</div>
			{error ? (
				<p id="page-title-error" className="pages-error" role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}
