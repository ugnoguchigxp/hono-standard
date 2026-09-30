import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

export type PageEditGuardState = {
	unsaved: boolean;
	saving: boolean;
};

const idleGuard: PageEditGuardState = { unsaved: false, saving: false };

type PageEditGuardContextValue = {
	guard: PageEditGuardState;
	setGuard: (guard: PageEditGuardState) => void;
	holdAutosaveRef: { current: boolean };
	editorHolds: ReadonlySet<string>;
	setEditorHold: (editorId: string, hold: boolean) => void;
};

const PageEditGuardContext = createContext<PageEditGuardContextValue | null>(
	null,
);

export function PageEditGuardProvider({ children }: { children: ReactNode }) {
	const [guard, setGuard] = useState<PageEditGuardState>(idleGuard);
	const holdAutosaveRef = useRef(false);
	const [editorHolds, setEditorHolds] = useState<Set<string>>(() => new Set());
	const setEditorHold = useCallback((editorId: string, hold: boolean) => {
		setEditorHolds((current) => {
			if (current.has(editorId) === hold) return current;
			const next = new Set(current);
			if (hold) next.add(editorId);
			else next.delete(editorId);
			return next;
		});
	}, []);
	const value = useMemo(
		() => ({ guard, setGuard, holdAutosaveRef, editorHolds, setEditorHold }),
		[editorHolds, guard, setEditorHold],
	);
	return (
		<PageEditGuardContext.Provider value={value}>
			{children}
		</PageEditGuardContext.Provider>
	);
}

export function usePageEditGuard(): PageEditGuardState {
	const value = useContext(PageEditGuardContext);
	if (!value) {
		throw new Error("PageEditGuard is missing.");
	}
	return value.guard;
}

export function usePublishPageAutosaveHold(hold: boolean): void {
	const value = useContext(PageEditGuardContext);
	if (!value) {
		throw new Error("PageEditGuard is missing.");
	}
	value.holdAutosaveRef.current = hold;
}

export function usePageAutosaveHold(): boolean {
	const value = useContext(PageEditGuardContext);
	if (!value) {
		throw new Error("PageEditGuard is missing.");
	}
	return value.holdAutosaveRef.current || value.editorHolds.size > 0;
}

export function usePageEditorAutosaveHold(): (hold: boolean) => void {
	const value = useContext(PageEditGuardContext);
	const editorId = useId();
	const setEditorHold = value?.setEditorHold;
	return useCallback(
		(hold: boolean) => setEditorHold?.(editorId, hold),
		[editorId, setEditorHold],
	);
}

export function useSyncPageEditGuard({ unsaved, saving }: PageEditGuardState) {
	const value = useContext(PageEditGuardContext);
	const setGuard = value?.setGuard;
	useLayoutEffect(() => {
		if (!setGuard) return;
		setGuard({ unsaved, saving });
		return () => setGuard(idleGuard);
	}, [unsaved, saving, setGuard]);
	if (!value) {
		throw new Error("PageEditGuard is missing.");
	}
}

export function PageLeaveDialog({
	titleId,
	title,
	confirmLabel,
	message,
	confirmDisabled = false,
	onConfirm,
	onCancel,
}: {
	titleId: string;
	title: string;
	confirmLabel: string;
	message?: string | null;
	confirmDisabled?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	const dialogRef = useRef<HTMLDivElement>(null);
	const cancelRef = useRef<HTMLButtonElement>(null);
	const onCancelRef = useRef(onCancel);
	onCancelRef.current = onCancel;

	useLayoutEffect(() => {
		const previousFocus =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		cancelRef.current?.focus();

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				onCancelRef.current();
				return;
			}
			if (event.key !== "Tab") return;

			const dialog = dialogRef.current;
			if (!dialog) return;
			const focusable = Array.from(
				dialog.querySelectorAll<HTMLElement>(
					'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
				),
			).filter(
				(element) =>
					!element.hidden && element.getAttribute("aria-hidden") !== "true",
			);
			if (focusable.length === 0) {
				event.preventDefault();
				dialog.focus();
				return;
			}

			event.preventDefault();
			const index = focusable.findIndex(
				(element) => element === document.activeElement,
			);
			const next = event.shiftKey
				? index <= 0
					? focusable.length - 1
					: index - 1
				: (index + 1) % focusable.length;
			focusable[next]?.focus();
		};

		document.addEventListener("keydown", handleKeyDown, true);
		return () => {
			document.removeEventListener("keydown", handleKeyDown, true);
			if (previousFocus?.isConnected) previousFocus.focus();
		};
	}, []);

	return (
		<div
			aria-labelledby={titleId}
			aria-modal="true"
			className="page-confirm"
			ref={dialogRef}
			role="alertdialog"
			tabIndex={-1}
		>
			<div className="page-confirm-panel">
				<h2 id={titleId}>{title}</h2>
				{message ? <p className="pages-error">{message}</p> : null}
				<div className="page-confirm-actions">
					<button
						className="auth-open-button"
						disabled={confirmDisabled}
						onClick={onConfirm}
						type="button"
					>
						{confirmLabel}
					</button>
					<button
						className="auth-open-button"
						onClick={onCancel}
						ref={cancelRef}
						type="button"
					>
						戻る
					</button>
				</div>
			</div>
		</div>
	);
}
