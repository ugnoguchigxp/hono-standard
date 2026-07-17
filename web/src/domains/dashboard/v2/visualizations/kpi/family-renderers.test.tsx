// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { dashboardDataFrameV2Schema } from "@shared/schemas/dashboard.schema";
import { tablePanel } from "../../test/fixtures";
import {
	BarGaugeSummary,
	BarGaugeView,
	BulletSummary,
	BulletView,
	GaugeSummary,
	GaugeView,
	ProgressSummary,
	ProgressView,
	StatLikeView,
	TrafficSummary,
	TrafficView,
} from "./family-renderers";

const frame = dashboardDataFrameV2Schema.parse({
	schemaVersion: 2,
	refId: "A",
	source: { kind: "query", refId: "A" },
	name: "KPI families",
	fields: [
		{
			key: "service",
			label: "Service",
			type: "string",
			values: ["api", "web", "worker"],
			roles: ["category"],
			labels: {},
		},
		{
			key: "value",
			label: "Value",
			type: "number",
			values: [72, 45, 88],
			roles: ["value"],
			labels: {},
		},
		{
			key: "previous",
			label: "Previous",
			type: "number",
			values: [70, 50, 80],
			roles: ["previous"],
			labels: {},
		},
		{
			key: "goal",
			label: "Goal",
			type: "number",
			values: [80, 70, 85],
			roles: ["goal"],
			labels: {},
		},
	],
	meta: { shapeHint: "category" },
});

function context(preset: string, config: Record<string, unknown> = {}) {
	return {
		dashboardId: "dashboard",
		panel: tablePanel(),
		frames: [frame],
		preset,
		config,
		timezone: "UTC",
		locale: "en-US",
		theme: { mode: "light" as const, palette: [] },
		interaction: {
			hiddenFieldKeys: new Set<string>(),
			toggleField: () => undefined,
			isolateField: () => undefined,
			resetFields: () => undefined,
			onDatumActivate: () => undefined,
		},
	};
}

describe("KPI family renderers", () => {
	it("renders native gauge, bars, bullets, progress, traffic, and stat primitives", () => {
		const gauge = context("semi-circle", {
			range: { min: "auto", max: "auto", overflow: "show-marker" },
		});
		const bars = context("horizontal", {
			range: { min: "auto", max: "auto", overflow: "show-marker" },
		});
		const bullet = context("comparative", {
			range: { min: "auto", max: "auto", overflow: "show-marker" },
		});
		const progress = context("segmented", {
			range: { min: "auto", max: "auto", overflow: "show-marker" },
			segmentCount: 8,
		});
		const traffic = context("list", {});
		const stat = context("value-delta-sparkline", {
			delta: {
				mode: "absolute",
				sentiment: "higher-is-better",
				zeroTolerance: 0,
			},
		});
		render(
			<>
				<GaugeView {...gauge} />
				<BarGaugeView {...bars} />
				<BulletView {...bullet} />
				<ProgressView {...progress} />
				<TrafficView {...traffic} />
				<StatLikeView {...stat} />
			</>,
		);
		expect(screen.getAllByText("api").length).toBeGreaterThan(0);
		expect(screen.getAllByText("72").length).toBeGreaterThan(0);
		expect(screen.getAllByText("unknown").length).toBeGreaterThan(0);
	});
	it("returns non-empty summaries for every KPI family", () => {
		const config = {
			range: { min: "auto", max: "auto", overflow: "show-marker" },
		};
		expect(GaugeSummary(context("semi-circle", config))).toContain(
			"Panel table",
		);
		expect(BarGaugeSummary(context("horizontal", config))).toContain(
			"Panel table",
		);
		expect(BulletSummary(context("horizontal", config))).toContain(
			"Panel table",
		);
		expect(ProgressSummary(context("linear", config))).toContain("Panel table");
		expect(TrafficSummary(context("list", config))).toContain("Panel table");
	});
});
