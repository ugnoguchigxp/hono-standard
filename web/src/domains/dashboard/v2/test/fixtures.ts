import type {
	DashboardDataFrameV2,
	PanelManifestV2,
} from "@shared/schemas/dashboard.schema";
export const tablePanel = (): PanelManifestV2 => ({
	id: "panel",
	title: "Panel",
	description: "",
	layout: { x: 0, y: 0, w: 4, h: 3, minW: 1, minH: 1 },
	queries: [
		{ refId: "A", queryId: "query", outputFrameRefs: ["A"], hidden: false },
	],
	transformations: [],
	visualization: {
		type: "core.table",
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
	accessibleLabel: "Panel table",
	links: [],
});
export const tableFrame = (
	rows: Array<{ name: string; value: number | null }>,
): DashboardDataFrameV2 => ({
	schemaVersion: 2,
	refId: "A",
	source: { kind: "query", refId: "A" },
	name: "Rows",
	fields: [
		{
			key: "name",
			label: "Name",
			type: "string",
			values: rows.map((row) => row.name),
			roles: ["category"],
			labels: {},
		},
		{
			key: "value",
			label: "Value",
			type: "number",
			values: rows.map((row) => row.value),
			roles: ["value"],
			labels: {},
		},
	],
	meta: { shapeHint: "table" },
});
