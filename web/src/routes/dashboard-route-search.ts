import type {
	DashboardFiltersV2,
	DashboardRangeV2,
	PublicDashboardManifestV2,
} from "@shared/schemas/dashboard.schema";
import { dashboardFiltersV2Schema } from "@shared/schemas/dashboard.schema";
import { z } from "zod";

export type DashboardRouteSearch = {
	range?: "15m" | "1h" | "6h" | "24h" | "7d" | "custom";
	from?: string;
	to?: string;
	timezone?: string;
	refresh?: number;
	filters?: DashboardFiltersV2;
};

const rangeSchema = z.enum(["15m", "1h", "6h", "24h", "7d", "custom"]);
const normalizeFilters = (value: unknown): DashboardFiltersV2 => {
	try {
		const parsed = typeof value === "string" ? JSON.parse(value) : value;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
			return {};
		const normalized = Object.fromEntries(
			Object.entries(parsed).flatMap(([key, values]) => {
				if (!Array.isArray(values)) return [];
				const result = [
					...new Set(
						values.filter(
							(v): v is string => typeof v === "string" && v.trim().length > 0,
						),
					),
				].sort();
				return result.length ? [[key, result]] : [];
			}),
		);
		const result = dashboardFiltersV2Schema.safeParse(normalized);
		return result.success ? result.data : {};
	} catch {
		return {};
	}
};

export function parseDashboardRouteSearch(
	search: Record<string, unknown>,
): DashboardRouteSearch {
	const range = rangeSchema.safeParse(search.range);
	const refreshRaw = search.refresh;
	const legacy = { off: 0, "10s": 10, "30s": 30, "1m": 60 } as const;
	const refresh =
		typeof refreshRaw === "string" && refreshRaw in legacy
			? legacy[refreshRaw as keyof typeof legacy]
			: typeof refreshRaw === "number" &&
					Number.isInteger(refreshRaw) &&
					refreshRaw >= 0 &&
					refreshRaw <= 3600
				? refreshRaw
				: undefined;
	return {
		range: range.success ? range.data : undefined,
		from: typeof search.from === "string" ? search.from : undefined,
		to: typeof search.to === "string" ? search.to : undefined,
		timezone:
			typeof search.timezone === "string" && search.timezone.length <= 64
				? search.timezone
				: undefined,
		refresh,
		filters: normalizeFilters(search.filters),
	};
}

const isValidDate = (value: string | undefined) =>
	!!value && Number.isFinite(Date.parse(value));
const canonicalIso = (value: string) => new Date(value).toISOString();
const stableFilters = (filters: DashboardFiltersV2): DashboardFiltersV2 =>
	Object.fromEntries(
		Object.entries(filters)
			.sort(([a], [b]) => a.localeCompare(b))
			.flatMap(([key, values]) => {
				const unique = [...new Set(values)].sort();
				return unique.length ? [[key, unique]] : [];
			}),
	);

export function timezoneOptions(defaultTimezone?: string): string[] {
	const fallback = [
		"UTC",
		"Asia/Tokyo",
		"America/Los_Angeles",
		"Europe/London",
	];
	let values: string[] = fallback;
	if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
		values = (
			Intl as typeof Intl & { supportedValuesOf: (key: "timeZone") => string[] }
		).supportedValuesOf("timeZone");
	}
	if (defaultTimezone && !values.includes(defaultTimezone))
		values = [defaultTimezone, ...values];
	return values;
}

export type ResolvedDashboardSearch = {
	range: DashboardRangeV2;
	timezone: string;
	refresh: number;
	filters: DashboardFiltersV2;
};

export function resolveDashboardSearch(input: {
	routeSearch: DashboardRouteSearch;
	manifest: PublicDashboardManifestV2;
	now?: Date;
}): {
	value: ResolvedDashboardSearch;
	canonicalRouteSearch: DashboardRouteSearch;
	needsReplace: boolean;
} {
	const { routeSearch, manifest } = input;
	const customFrom = routeSearch.from;
	const customTo = routeSearch.to;
	const candidateRange =
		routeSearch.range === "custom" &&
		isValidDate(customFrom) &&
		isValidDate(customTo) &&
		customFrom &&
		customTo &&
		Date.parse(customFrom) < Date.parse(customTo)
			? {
					kind: "absolute" as const,
					from: canonicalIso(customFrom),
					to: canonicalIso(customTo),
				}
			: routeSearch.range && routeSearch.range !== "custom"
				? { kind: "relative" as const, value: routeSearch.range }
				: manifest.defaultRange;
	const timezone = routeSearch.timezone?.trim() || manifest.defaultTimezone;
	const refresh = routeSearch.refresh ?? manifest.defaultRefreshSeconds;
	const filters = stableFilters({
		...Object.fromEntries(
			manifest.variables.flatMap((variable) =>
				variable.defaultValues.length
					? [[variable.id, variable.defaultValues]]
					: [],
			),
		),
		...(routeSearch.filters ?? {}),
	});
	const canonical: DashboardRouteSearch = {
		range: candidateRange.kind === "absolute" ? "custom" : candidateRange.value,
		...(candidateRange.kind === "absolute"
			? { from: candidateRange.from, to: candidateRange.to }
			: {}),
		timezone,
		refresh,
		filters,
	};
	const value = {
		range: candidateRange,
		timezone,
		refresh,
		filters,
	};
	const current = JSON.stringify(parseDashboardRouteSearch(routeSearch));
	const next = JSON.stringify(canonical);
	return {
		value,
		canonicalRouteSearch: canonical,
		needsReplace: current !== next,
	};
}
