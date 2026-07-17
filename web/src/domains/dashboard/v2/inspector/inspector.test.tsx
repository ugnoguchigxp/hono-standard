// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { tablePanel } from "../test/fixtures";
import { DashboardInspector } from "./inspector";
import "../test/setup";

describe("DashboardInspector", () => {
	it("renders sanitized request metadata and closes", async () => {
		const onClose = vi.fn();
		render(
			<DashboardInspector
				panel={tablePanel()}
				response={{
					schemaVersion: 2,
					requestId: "11111111-1111-4111-8111-111111111111",
					generatedAt: "2026-07-16T00:00:00.000Z",
					resolvedRange: {
						from: "2026-07-16T00:00:00.000Z",
						to: "2026-07-16T01:00:00.000Z",
					},
					durationMs: 12,
					counts: { frames: 1, fields: 2, rows: 3, cells: 6 },
					state: { partial: false, truncated: false, notices: [] },
					frames: [],
				}}
				onClose={onClose}
			/>,
		);
		expect(
			screen.getByRole("complementary", { name: "Query inspector" }),
		).toHaveTextContent("12 ms");
		expect(screen.getByText("1 / 3")).toBeVisible();
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: "Close inspector" }));
		expect(onClose).toHaveBeenCalledOnce();
	});
	it("renders safe empty metadata", () => {
		render(<DashboardInspector panel={tablePanel()} onClose={vi.fn()} />);
		expect(screen.getAllByText("—")).toHaveLength(3);
	});
	it("redacts sensitive frame values in the Frames tab", async () => {
		render(
			<DashboardInspector
				panel={tablePanel()}
				response={{
					schemaVersion: 2,
					requestId: "11111111-1111-4111-8111-111111111111",
					generatedAt: "2026-07-16T00:00:00.000Z",
					resolvedRange: {
						from: "2026-07-16T00:00:00.000Z",
						to: "2026-07-16T01:00:00.000Z",
					},
					durationMs: 1,
					counts: { frames: 1, fields: 1, rows: 1, cells: 1 },
					state: { partial: false, truncated: false, notices: [] },
					frames: [
						{
							schemaVersion: 2,
							refId: "A",
							source: { kind: "query", refId: "A" },
							name: "Users",
							fields: [
								{
									key: "email",
									label: "Email",
									type: "string",
									values: ["person@example.com"],
									roles: [],
									labels: {},
								},
							],
							meta: { shapeHint: "table" },
						},
					],
				}}
				onClose={vi.fn()}
			/>,
		);
		await userEvent.setup().click(screen.getByRole("tab", { name: "Frames" }));
		expect(screen.getByText(/\[redacted\]/)).toBeVisible();
		expect(screen.queryByText(/person@example.com/)).not.toBeInTheDocument();
		for (const tab of [
			"Request",
			"Transformations",
			"Visualization",
			"Error",
		] as const)
			await userEvent.setup().click(screen.getByRole("tab", { name: tab }));
		expect(
			screen.getByRole("button", { name: "Copy sanitized JSON" }),
		).toBeVisible();
	});
});
