import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FrontendVisualizationRegistry } from "./visualization-registry";
import type {
	AnyFrontendVisualizationDefinition,
	DashboardRendererModule,
} from "./visualization-types";

export const rendererQueryKey = (type: string, version: number) =>
	["dashboard-renderer", type, version] as const;
export function useRendererModule(
	registry: FrontendVisualizationRegistry,
	definition: AnyFrontendVisualizationDefinition,
) {
	const queryClient = useQueryClient();
	const query = useQuery<DashboardRendererModule<unknown>, Error>({
		queryKey: rendererQueryKey(
			definition.descriptor.type,
			definition.descriptor.configSchemaVersion,
		),
		queryFn: () => registry.load(definition.descriptor.type),
		staleTime: Infinity,
		gcTime: Infinity,
		retry: 1,
	});
	return {
		...query,
		retryLoad: () => {
			registry.clearFailedLoad(definition.descriptor.type);
			void queryClient.resetQueries({
				queryKey: rendererQueryKey(
					definition.descriptor.type,
					definition.descriptor.configSchemaVersion,
				),
				exact: true,
			});
		},
	};
}
