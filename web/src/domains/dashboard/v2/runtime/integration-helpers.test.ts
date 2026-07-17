// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createDashboardFrontendRuntime } from "./dashboard-runtime";
import { rendererQueryKey } from "./renderer-loader";
import { resolveFieldConfig } from "./field-config";
import { derivePanelState } from "./panel-state";
import { tableFrame, tablePanel } from "../test/fixtures";
import "../test/setup";
describe("runtime integration helpers", () => { it("builds injectable registries and loader keys", () => { const runtime = createDashboardFrontendRuntime({}); expect(runtime.visualizations.getTypes()).toEqual([]); expect(rendererQueryKey("core.table", 1)).toEqual(["dashboard-renderer", "core.table", 1]); }); it("applies panel field overrides and prioritizes incompatible state", () => { const panel = { ...tablePanel(), visualization: { ...tablePanel().visualization, fieldConfig: { ...tablePanel().visualization.fieldConfig, decimals: 0 }, overrides: [{ id: "override", matcher: { kind: "field-name" as const, fieldKey: "value" }, properties: { noValueText: "N/A" } }] } }; const frame = tableFrame([{ name: "a", value: null }]); expect(resolveFieldConfig(panel, frame, frame.fields[1]!).noValueText).toBe("N/A"); expect(derivePanelState({ isPending: false, hasData: true, incompatible: true })).toBe("incompatible"); }); });
