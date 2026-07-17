// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { tablePanel } from "../test/fixtures";
import {
	layoutsFromManifest,
	moveDashboardLayout,
	restoreLayouts,
	writeStoredLayouts,
} from "./layout";
import { useDashboardLayoutState } from "./layout-state";
import "../test/setup";

const manifest = {
	schemaVersion: 2 as const,
	revision: 1,
	id: "dashboard",
	title: "Dashboard",
	description: "",
	layoutVersion: 1,
	defaultRange: { kind: "relative" as const, value: "1h" as const },
	defaultTimezone: "UTC",
	defaultRefreshSeconds: 0,
	variables: [],
	panels: [tablePanel()],
	inspectorEnabled: true,
};
describe("dashboard v2 layout", () => {
	it("restores and persists layouts by version", () => {
		const defaults = layoutsFromManifest(manifest);
		writeStoredLayouts("dashboard", 1, defaults);
		expect(
			JSON.parse(
				window.localStorage.getItem(
					"hono-standard:dashboard-layout:dashboard:v1",
				) ?? "null",
			).layouts,
		).toEqual(defaults);
		expect(restoreLayouts(manifest)).toEqual(defaults);
		window.localStorage.setItem(
			"hono-standard:dashboard-layout:dashboard:v2",
			JSON.stringify({ layoutVersion: 2, layouts: defaults }),
		);
		expect(restoreLayouts({ ...manifest, layoutVersion: 2 })).toEqual(defaults);
		window.localStorage.setItem(
			"hono-standard:dashboard-layout:dashboard:v1",
			"{",
		);
		expect(restoreLayouts(manifest)).toEqual(defaults);
	});
	it("supports edit save, cancel and reset", () => {
		const initial = layoutsFromManifest(manifest);
		const first = initial.lg[0];
		if (!first) throw new Error("expected a default layout item");
		const hook = renderHook(() => useDashboardLayoutState(initial));
		act(() => hook.result.current.enterEdit());
		expect(hook.result.current.mode).toBe("edit-clean");
		act(() =>
			hook.result.current.update({
				...initial,
				lg: [{ ...first, y: 5 }],
			}),
		);
		expect(hook.result.current.mode).toBe("edit-dirty");
		act(() => hook.result.current.cancel());
		expect(hook.result.current.mode).toBe("view");
		act(() => hook.result.current.enterEdit());
		act(() => hook.result.current.reset());
		expect(hook.result.current.mode).toBe("edit-dirty");
	});
	it("moves items for keyboard ordering and handles boundaries", () => {
		const initial = layoutsFromManifest({
			...manifest,
			panels: [
				tablePanel(),
				{ ...tablePanel(), id: "second", title: "Second" },
			],
		});
		expect(moveDashboardLayout(initial, "second", "up").lg[0]?.i).toBe(
			"second",
		);
		expect(moveDashboardLayout(initial, "panel", "up").lg[0]?.i).toBe("panel");
		expect(moveDashboardLayout(initial, "missing", "down")).toEqual(initial);
	});
});
