import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StateLegend, StateTable, UptimeTable } from "./primitives";

describe("state primitives", () => {
	it("exposes keyboard-operable state filters", () => {
		const onToggle = vi.fn();
		render(<StateLegend hidden={new Set(["warning"])} onToggle={onToggle} />);
		expect(screen.getByRole("button", { name: /warning/i })).toHaveAttribute(
			"aria-pressed",
			"false",
		);
		fireEvent.click(screen.getByRole("button", { name: /critical/i }));
		expect(onToggle).toHaveBeenCalledWith("critical");
	});
	it("keeps missing intervals in the derived table", () => {
		render(
			<StateTable
				intervals={[]}
				gaps={[
					{
						laneId: "api",
						laneLabel: "API",
						start: 10,
						end: 20,
						missing: true,
					},
				]}
			/>,
		);
		expect(screen.getByRole("cell", { name: "Missing" })).toBeVisible();
		expect(screen.getByRole("cell", { name: "Yes" })).toBeVisible();
	});
	it("keeps uptime cells aligned with their column headers", () => {
		render(
			<UptimeTable
				buckets={[
					{
						laneId: "api",
						laneLabel: "API",
						start: 0,
						end: 100,
						observedMs: 80,
						healthyMs: 60,
						warningMs: 10,
						criticalMs: 5,
						unknownMs: 5,
						missingMs: 20,
						uptimeRatio: 0.75,
						dominantState: "healthy",
						incidentCount: 3,
					},
				]}
			/>,
		);
		const cells = screen.getAllByRole("cell").map((cell) => cell.textContent);
		expect(cells).toEqual([
			"API",
			"0–100",
			"80.0%",
			"60",
			"10",
			"5",
			"5",
			"20",
			"75.00%",
			"3",
		]);
	});
});
