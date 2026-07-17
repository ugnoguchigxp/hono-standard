// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { tableFrame, tablePanel } from "../test/fixtures";
import { PanelTable } from "./panel-table";
import "../test/setup";

describe("PanelTable", () => {
	it("renders a semantic table with formatted values", () => {
		render(
			<PanelTable
				frames={[
					tableFrame([
						{ name: "api", value: 0 },
						{ name: "worker", value: null },
					]),
				]}
				panel={tablePanel()}
			/>,
		);
		expect(screen.getByRole("table", { name: "Panel table" })).toBeVisible();
		expect(screen.getByText("0")).toBeVisible();
		expect(screen.getByText("—")).toBeVisible();
	});
	it("caps DOM rows at 100", () => {
		const rows = Array.from({ length: 101 }, (_, index) => ({
			name: `row-${index}`,
			value: index,
		}));
		render(<PanelTable frames={[tableFrame(rows)]} panel={tablePanel()} />);
		expect(screen.getByRole("table").querySelectorAll("tbody tr")).toHaveLength(
			100,
		);
		expect(screen.getByText("Showing the first 100 rows.")).toBeVisible();
	});
	it("groups columns by frame for multi-frame results", () => {
		const primary = tableFrame([{ name: "api", value: 1 }]);
		const secondary = {
			...tableFrame([{ name: "worker", value: 2 }]),
			refId: "B",
			name: "Secondary",
		};
		render(
			<PanelTable
				frames={[{ ...primary, name: "Primary" }, secondary]}
				panel={tablePanel()}
			/>,
		);
		expect(
			screen.getByRole("columnheader", { name: "Primary" }),
		).toHaveAttribute("colspan", "2");
		expect(
			screen.getByRole("columnheader", { name: "Secondary" }),
		).toHaveAttribute("colspan", "2");
	});
});
