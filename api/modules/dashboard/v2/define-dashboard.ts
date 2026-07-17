import {
	dashboardManifestV2Schema,
	variableManifestV2Schema,
} from "../../../../shared/schemas/dashboard.schema";
import type {
	DashboardDefinitionV2,
	DashboardQueryDefinitionV2,
	DashboardVariableDefinitionV2,
} from "./types";

export function defineDashboardQueryV2(
	input: DashboardQueryDefinitionV2,
): DashboardQueryDefinitionV2 {
	if (typeof input.handler !== "function")
		throw new TypeError("query handler is required");
	const filterKeys = [...new Set(input.filterKeys)];
	if (filterKeys.length !== input.filterKeys.length)
		throw new Error("query filter keys must be unique");
	if (input.outputShapes.length < 1 || input.outputShapes.length > 4)
		throw new Error("query output shapes must contain one to four shapes");
	return {
		...input,
		filterKeys,
		interval: input.interval ?? "auto",
		outputShapes: [...input.outputShapes],
	};
}

export function defineDashboardV2(
	input: DashboardDefinitionV2,
): DashboardDefinitionV2 {
	const manifest = dashboardManifestV2Schema.parse(input.manifest);
	const variables = input.variables.map(
		(value): DashboardVariableDefinitionV2 => ({
			manifest: variableManifestV2Schema.parse(value.manifest),
			options: value.options,
		}),
	);
	const queries = input.queries.map(defineDashboardQueryV2);
	return { manifest, variables, queries };
}
