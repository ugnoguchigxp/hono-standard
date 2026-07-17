import type {
	DashboardFiltersV2,
	PanelQueryRequestV2,
} from "@shared/schemas/dashboard.schema";

export const stableJson = (value: unknown): string => {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
	if (value && typeof value === "object")
		return `{${Object.entries(value as Record<string, unknown>)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`)
			.join(",")}}`;
	return JSON.stringify(value) ?? "undefined";
};
export const dashboardManifestV2QueryKey = (id: string) =>
	["dashboard-v2", id, "manifest"] as const;
export const dashboardVariableV2QueryKey = (
	id: string,
	variableId: string,
	body: { range: unknown; timezone: string; filters: DashboardFiltersV2 },
) => ["dashboard-v2", id, "variable", variableId, stableJson(body)] as const;
export const dashboardPanelV2QueryKey = (
	id: string,
	panelId: string,
	request: PanelQueryRequestV2,
) => ["dashboard-v2", id, "panel", panelId, stableJson(request)] as const;
export const browserTransformV2QueryKey = (
	panelId: string,
	requestId: string,
	transformationKey: string,
) =>
	[
		"dashboard-browser-transform",
		panelId,
		requestId,
		transformationKey,
	] as const;
