import { useCallback, useEffect, useState } from "react";
import type { DashboardLayouts } from "./layout";
export type LayoutMode = "view" | "edit-clean" | "edit-dirty";
export function useDashboardLayoutState(initial: DashboardLayouts) {
	const [saved, setSaved] = useState(initial);
	const [draft, setDraft] = useState(initial);
	const [mode, setMode] = useState<LayoutMode>("view");
	useEffect(() => {
		setSaved(initial);
		setDraft(initial);
		setMode("view");
	}, [initial]);
	const update = useCallback(
		(next: DashboardLayouts) => {
			setDraft(next);
			setMode(
				JSON.stringify(next) === JSON.stringify(saved)
					? "edit-clean"
					: "edit-dirty",
			);
		},
		[saved],
	);
	return {
		saved,
		draft,
		mode,
		enterEdit: () => setMode("edit-clean"),
		update,
		save: () => {
			setSaved(draft);
			setMode("view");
		},
		cancel: () => {
			setDraft(saved);
			setMode("view");
		},
		reset: () => {
			setDraft(initial);
			setMode("edit-dirty");
		},
	};
}
