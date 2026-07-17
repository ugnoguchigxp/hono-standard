import type { PanelData } from "../../../shared/schemas/dashboard.schema";

export const timeSeriesResult = (
	series: Extract<PanelData, { kind: "timeseries" }>["series"],
	rows: Extract<PanelData, { kind: "timeseries" }>["rows"],
): Extract<PanelData, { kind: "timeseries" }> => ({
	kind: "timeseries",
	series,
	rows,
});

export const categoryResult = (
	series: Extract<PanelData, { kind: "category" }>["series"],
	rows: Extract<PanelData, { kind: "category" }>["rows"],
): Extract<PanelData, { kind: "category" }> => ({
	kind: "category",
	series,
	rows,
});

export const statResult = (
	value: Extract<PanelData, { kind: "stat" }>["value"],
	series?: Extract<PanelData, { kind: "stat" }>["series"],
): Extract<PanelData, { kind: "stat" }> => ({ kind: "stat", value, series });

export const tableResult = (
	columns: Extract<PanelData, { kind: "table" }>["columns"],
	rows: Extract<PanelData, { kind: "table" }>["rows"],
): Extract<PanelData, { kind: "table" }> => ({ kind: "table", columns, rows });
