// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { tablePanel } from "../../test/fixtures";
import { buildAccessibleSummary, Renderer } from "./renderer.lazy";
import "../../test/setup";

describe("core.uptime-grid renderer", () => {
	it("renders the uptime grid and summary correctly", () => {
		const frame: Parameters<typeof Renderer>[0]["frames"][number] = {
			schemaVersion: 2,
			refId: "A",
			source: { kind: "query", refId: "A" } as const,
			name: "states",
			fields: [
				{ key: "time", label: "Time", type: "time" as const, values: [0, 10, 20], roles: ["time"], labels: {} },
				{ key: "state", label: "State", type: "string" as const, values: ["healthy", "warning", "healthy"], roles: ["state"], labels: {} },
				{ key: "lane", label: "Lane", type: "string" as const, values: ["api", "api", "api"], roles: ["category"], labels: {} }
			],
			meta: { shapeHint: "state-sample" }
		};

		const context: Parameters<typeof Renderer>[0] = {
			dashboardId: "d",
			panel: {
				...tablePanel(),
				accessibleLabel: "My Uptime Grid",
				visualization: {
					...tablePanel().visualization,
					type: "core.uptime-grid",
					frameRefs: ["A"],
				},
			},
			frames: [frame],
			preset: "default",
			config: {
				range: "query" as const,
				bucket: "hour" as const,
				minimumCoveragePercent: 0,
				showIncidentCount: false,
				showPercentage: true,
				missing: "gap" as const,
				weekStartsOn: "monday" as const,
			},
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
			resolvedRange: { from: 0, to: 30 },
		};

		const { container } = render(<Renderer {...context} />);
		
		expect(screen.getByRole("img", { name: "Uptime grid" })).toBeVisible();
		expect(container.querySelector(".dashboard-uptime-grid")).toBeInTheDocument();

		// test accessible summary
		const summary = buildAccessibleSummary(context);
		expect(summary).toContain("My Uptime Grid");

		// test legend interaction
		const healthyLegend = screen.getByRole("button", { name: /healthy/i });
		expect(healthyLegend).toBeInTheDocument();
		fireEvent.click(healthyLegend); // toggle
	});

	it("renders unavailable state when no frames are present", () => {
		const context: Parameters<typeof Renderer>[0] = {
			dashboardId: "d",
			panel: {
				...tablePanel(),
				accessibleLabel: "Empty Grid",
				visualization: {
					...tablePanel().visualization,
					type: "core.uptime-grid",
					frameRefs: ["A"],
				},
			},
			frames: [],
			preset: "default",
			config: {
				range: "query" as const,
				bucket: "hour" as const,
				minimumCoveragePercent: 0,
				showIncidentCount: false,
				showPercentage: true,
				missing: "gap" as const,
				weekStartsOn: "monday" as const,
			},
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
			resolvedRange: { from: 0, to: 30 },
		};
		render(<Renderer {...context} />);
		expect(screen.getByText("Uptime data is unavailable")).toBeVisible();
		expect(buildAccessibleSummary(context)).toContain("Uptime data is unavailable");
	});
});
