// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { tablePanel } from "../../test/fixtures";
import { buildAccessibleSummary, Renderer } from "./renderer.lazy";
import { dataFrame, numberField, stringField } from "../../../../../../../api/modules/dashboard/v2/frame-builders";
import "../../test/setup";

describe("geo-map renderer", () => {
	it("renders the geo map and summary correctly", () => {
		const pointsFrame = dataFrame({
			refId: "A",
			name: "GeoPoints",
			fields: [
				numberField("lat", [35.6, 51.5], { roles: ["latitude"] }),
				numberField("lon", [139.6, -0.1], { roles: ["longitude"] }),
				stringField("label", ["Tokyo", "London"], { roles: ["label"] }),
				numberField("value", [10, 20], { roles: ["value"] }),
			],
		});

		const context: Parameters<typeof Renderer>[0] = {
			dashboardId: "d",
			panel: {
				...tablePanel(),
				visualization: {
					...tablePanel().visualization,
					type: "core.geomap",
					frameRefs: ["A"],
				},
			},
			frames: [pointsFrame as never],
			preset: "points",
			config: {
				clusterCellPx: 32,
				showOutline: true,
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
		};

		const { container } = render(<Renderer {...context} />);
		
		expect(container.querySelector("svg")).toBeInTheDocument();
		expect(screen.getByRole("img")).toBeInTheDocument();

		const summary = buildAccessibleSummary(context);
		expect(summary).toContain("2 points");
	});
});
