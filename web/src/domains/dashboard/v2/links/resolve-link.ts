import type {
	DashboardFiltersV2,
	DashboardRangeV2,
	PanelLinkV2,
} from "@shared/schemas/dashboard.schema";
import { dashboardLinkTargets } from "./link-targets";
export function resolveDashboardLinkV2(
	link: PanelLinkV2,
	filters: DashboardFiltersV2,
	range: DashboardRangeV2,
	fieldValues: Record<string, unknown>,
	frameRef?: string,
) {
	const path =
		dashboardLinkTargets[link.targetId as keyof typeof dashboardLinkTargets];
	if (!path || path !== link.to || !path.startsWith("/")) return null;
	const search: Record<string, string> = {};
	for (const [key, source] of Object.entries(link.search)) {
		let value: unknown;
		if (source.kind === "field") value = fieldValues[source.fieldKey];
		else if (source.kind === "filter") {
			const values = filters[source.variableId];
			value = values?.length
				? source.format === "first"
					? values[0]
					: source.format === "json"
						? JSON.stringify(values)
						: values.join(",")
				: undefined;
		} else
			value =
				source.kind === "constant"
					? String(source.value)
					: source.kind === "dashboard-range-from"
						? range.kind === "absolute"
							? range.from
							: undefined
						: source.kind === "dashboard-range-to"
							? range.kind === "absolute"
								? range.to
								: undefined
							: source.kind === "frame-ref"
								? frameRef
								: undefined;
		if (value === undefined || value === null) return null;
		search[key] = String(value);
	}
	if (link.includeRange)
		search.range =
			range.kind === "relative" ? range.value : `${range.from},${range.to}`;
	if (link.includeFilters) search.filters = JSON.stringify(filters);
	return { to: path, search, openInNewTab: link.openInNewTab };
}
