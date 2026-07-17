import type {
	PanelQueryRequestV2,
	PublicDashboardManifestV2,
} from "@shared/schemas/dashboard.schema";
import {
	type QueryClient,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	DashboardApiErrorV2,
	fetchDashboardManifestV2,
	fetchPanelQueryV2,
	fetchVariableOptionsV2,
} from "./api";
import {
	dashboardManifestV2QueryKey,
	dashboardPanelV2QueryKey,
	dashboardVariableV2QueryKey,
} from "./query-keys";
export const useDashboardManifestV2 = (id: string) =>
	useQuery({
		queryKey: dashboardManifestV2QueryKey(id),
		queryFn: ({ signal }) => fetchDashboardManifestV2(id, signal),
		staleTime: 60_000,
	});
export function useDashboardVariablesV2(
	id: string,
	manifest: PublicDashboardManifestV2 | undefined,
	range: PanelQueryRequestV2["range"],
	timezone: string,
	filters: Record<string, string[]>,
	enabled = true,
) {
	const queryClient = useQueryClient();
	const variables = manifest?.variables ?? [];
	const bodyFor = (variable: (typeof variables)[number]) => ({
		schemaVersion: 2 as const,
		range,
		timezone,
		filters: Object.fromEntries(
			variable.dependsOn.flatMap((dependency) =>
				filters[dependency]?.length ? [[dependency, filters[dependency]]] : [],
			),
		),
	});
	return useQueries({
		queries: variables.map((variable) => {
			const body = bodyFor(variable);
			const dependenciesReady = variable.dependsOn.every((dependencyId) => {
				const dependency = variables.find(
					(candidate) => candidate.id === dependencyId,
				);
				if (!dependency || !filters[dependencyId]?.length) return false;
				return (
					queryClient.getQueryState(
						dashboardVariableV2QueryKey(id, dependency.id, bodyFor(dependency)),
					)?.status === "success"
				);
			});
			return {
				queryKey: dashboardVariableV2QueryKey(id, variable.id, body),
				enabled: enabled && dependenciesReady,
				queryFn: ({ signal }: { signal: AbortSignal }) =>
					fetchVariableOptionsV2(id, variable.id, body, signal),
				staleTime: 60_000,
				retry: (count: number, error: Error) =>
					error instanceof DashboardApiErrorV2 && error.retryable && count < 2,
				retryDelay: (attempt: number) => Math.min(1_000 * 2 ** attempt, 5_000),
			};
		}),
	});
}
export function useDashboardPanelsV2(
	id: string,
	manifest: PublicDashboardManifestV2 | undefined,
	request: PanelQueryRequestV2,
	refresh: number,
	enabled = true,
) {
	return useQueries({
		queries: (manifest?.panels ?? []).map((panel) => ({
			queryKey: dashboardPanelV2QueryKey(id, panel.id, request),
			queryFn: ({ signal }: { signal: AbortSignal }) =>
				fetchPanelQueryV2(id, panel.id, request, signal),
			enabled,
			refetchInterval: refresh > 0 ? refresh * 1000 : false,
			retry: (count: number, error: Error) =>
				error instanceof DashboardApiErrorV2 && error.retryable && count < 2,
			retryDelay: (attempt: number) => Math.min(1_000 * 2 ** attempt, 5_000),
			refetchIntervalInBackground: false,
		})),
	});
}
export function prefetchDashboardManifestV2(
	queryClient: QueryClient,
	id: string,
) {
	return queryClient.prefetchQuery({
		queryKey: dashboardManifestV2QueryKey(id),
		queryFn: ({ signal }) => fetchDashboardManifestV2(id, signal),
		staleTime: 60_000,
	});
}
