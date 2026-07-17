import { FrontendTransformationRegistry } from "./transformation-registry";
import type { AnyFrontendTransformationDefinition } from "./transformation-types";
import { FrontendVisualizationRegistry } from "./visualization-registry";
import type { AnyFrontendVisualizationDefinition } from "./visualization-types";
import { coreTransformationCatalog } from "../transformations/catalog";
export type DashboardFrontendRuntime = {
	visualizations: FrontendVisualizationRegistry;
	transformations: FrontendTransformationRegistry;
};
export function createDashboardFrontendRuntime(input: {
	visualizations?: AnyFrontendVisualizationDefinition[];
	transformations?: AnyFrontendTransformationDefinition[];
}): DashboardFrontendRuntime {
	return {
		visualizations: new FrontendVisualizationRegistry(
			input.visualizations ?? [],
		),
		transformations: new FrontendTransformationRegistry(
			input.transformations ?? coreTransformationCatalog,
		),
	};
}
