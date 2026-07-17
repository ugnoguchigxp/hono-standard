// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Renderer, buildAccessibleSummary } from "./renderer.lazy";
import { tableFrame, tablePanel } from "../../test/fixtures";
import "../../test/setup";

describe("core.table renderer", () => {
	it("uses the generic table and reports row count", () => {
		const context = {
			dashboardId: "d",
			panel: tablePanel(),
			frames: [tableFrame([{ name: "api", value: 1 }])],
			preset: "table",
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
		expect(screen.getByRole("table", { name: "Panel table" })).toBeVisible();
		expect(buildAccessibleSummary(context)).toContain("1 rows");
	});
});
