import type { DashboardDataFrameV2 } from "./data-frame.schema";
import type { PanelManifestV2 } from "./manifest-v2.schema";

export const timeseriesFrame = (refId = "A"): DashboardDataFrameV2 => ({
	schemaVersion: 2,
	refId,
	source: { kind: "query", refId: "A" },
	name: "Requests",
	fields: [
		{
			key: "time",
			label: "Time",
			type: "time",
			roles: ["time"],
			labels: {},
			values: [1_000, 2_000],
		},
		{
			key: "requests",
			label: "Requests",
			type: "number",
			roles: ["value"],
			labels: {},
			values: [1, 2],
		},
	],
	meta: { shapeHint: "timeseries" },
});

export const panelFixture = (): PanelManifestV2 => ({
	id: "requests",
	title: "Requests",
	description: "",
	layout: { x: 0, y: 0, w: 6, h: 4, minW: 1, minH: 1 },
	queries: [
		{ refId: "A", queryId: "requests", outputFrameRefs: ["A"], hidden: false },
	],
	transformations: [],
	visualization: {
		type: "core.timeseries",
		preset: "line",
		frameRefs: ["A"],
		options: {},
		fieldConfig: {
			unit: { kind: "none" },
			decimals: "auto",
			noValueText: "—",
			textAlign: "auto",
			valueMappings: [],
			links: [],
		},
		overrides: [],
		tableFallback: { enabled: true, defaultView: "visualization" },
	},
	accessibleLabel: "Requests over time",
	links: [],
});
