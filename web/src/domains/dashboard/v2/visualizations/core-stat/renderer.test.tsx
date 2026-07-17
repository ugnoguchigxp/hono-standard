// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { tableFrame, tablePanel } from "../../test/fixtures";
import { buildAccessibleSummary, Renderer } from "./renderer.lazy";
import "../../test/setup";

describe("core.stat renderer", () => {
	it("renders the exact frame value and summary", () => {
		const frame = tableFrame([{ name: "api", value: 42 }]);
		const context = {
			dashboardId: "d",
			panel: {
				...tablePanel(),
				visualization: {
					...tablePanel().visualization,
					type: "core.stat",
					frameRefs: ["A"],
				},
			},
			frames: [frame],
			preset: "value",
			config: {},
			timezone: "UTC",
			locale: "en-US",
			theme: { mode: "dark" as const, palette: [] },
			interaction: {
				hiddenFieldKeys: new Set<string>(),
				toggleField: () => undefined,
				isolateField: () => undefined,
				resetFields: () => undefined,
				onDatumActivate: () => undefined,
			},
		};
		render(<Renderer {...context} />);
		expect(screen.getByRole("img", { name: "Panel table" })).toBeVisible();
		expect(screen.getByText("42")).toBeVisible();
		expect(buildAccessibleSummary(context)).toContain("42");
	});
	it("renders a complete unavailable state instead of a large placeholder", () => {
		const frame = tableFrame([{ name: "api", value: null }]);
		const context = {
			dashboardId: "d",
			panel: {
				...tablePanel(),
				visualization: {
					...tablePanel().visualization,
					type: "core.stat",
					frameRefs: ["A"],
				},
			},
			frames: [frame],
			preset: "value",
			config: {},
			timezone: "UTC",
			locale: "en-US",
			theme: { mode: "dark" as const, palette: [] },
			interaction: {
				hiddenFieldKeys: new Set<string>(),
				toggleField: () => undefined,
				isolateField: () => undefined,
				resetFields: () => undefined,
				onDatumActivate: () => undefined,
			},
		};
		render(<Renderer {...context} />);
		expect(screen.getByText("No current value")).toBeVisible();
		expect(screen.getByText("Unavailable")).toBeVisible();
		expect(screen.queryByText("N/A")).not.toBeInTheDocument();
		expect(buildAccessibleSummary(context)).toContain("No current value");
		expect(buildAccessibleSummary(context)).not.toContain("N/A");
	});
});
