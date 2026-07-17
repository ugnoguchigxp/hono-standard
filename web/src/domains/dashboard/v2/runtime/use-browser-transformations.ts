import type {
	PanelManifestV2,
	PanelQueryResponseV2,
} from "@shared/schemas/dashboard.schema";
import { useQuery } from "@tanstack/react-query";
import { browserTransformV2QueryKey, stableJson } from "../query-keys";
import { executeBrowserTransformations } from "./transformation-executor";
import type { FrontendTransformationRegistry } from "./transformation-registry";
export function useBrowserTransformations(
	panel: PanelManifestV2,
	response: PanelQueryResponseV2 | undefined,
	registry: FrontendTransformationRegistry,
) {
	const enabled =
		!!response &&
		panel.transformations.some(
			(item) => !item.disabled && item.execution === "browser",
		);
	return useQuery({
		queryKey: browserTransformV2QueryKey(
			panel.id,
			response?.requestId ?? "none",
			stableJson(panel.transformations),
		),
		enabled,
		queryFn: ({ signal }) =>
			executeBrowserTransformations({
				panel,
				responseFrames: response?.frames ?? [],
				requestId: response?.requestId ?? "",
				registry,
				signal,
			}),
	});
}
