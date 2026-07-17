// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	GaugeArc,
	GaugeNeedle,
	NativeSparkline,
	RangeTrack,
	SegmentTrack,
	TrafficSignal,
} from "./primitives";

describe("KPI native primitives", () => {
	it("keeps decorative SVG out of the tab order", () => {
		const { container } = render(
			<>
				<GaugeArc
					normalized={0.5}
					startAngle={-180}
					endAngle={0}
					label="gauge"
				/>
				<GaugeNeedle
					normalized={0.5}
					startAngle={-225}
					endAngle={45}
					label="needle"
				/>
				<NativeSparkline values={[1, null, 2]} label="trend" />
			</>,
		);
		expect(container.querySelectorAll("svg[tabindex]")).toHaveLength(0);
		expect(
			container.querySelectorAll("svg line.dashboard-kpi-needle-line"),
		).toHaveLength(1);
		expect(container.querySelectorAll("polyline")).toHaveLength(1);
	});

	it("uses explicit goal and overflow semantics", () => {
		const { getByRole } = render(
			<>
				<RangeTrack normalized={1.25} goal={0.75} label="Capacity" />
				<SegmentTrack normalized={0.5} count={4} label="50 percent complete" />
				<TrafficSignal state="critical" label="API">
					API: down
				</TrafficSignal>
			</>,
		);
		expect(getByRole("img", { name: "Capacity" })).toBeTruthy();
		expect(getByRole("img", { name: "50 percent complete" })).toBeTruthy();
		expect(getByRole("img", { name: "API: critical" })).toHaveTextContent(
			"API: down",
		);
	});
});
