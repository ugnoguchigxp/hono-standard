import {
	dashboardManifestSchema,
	panelManifestSchema,
	variableManifestSchema,
} from "../../../shared/schemas/dashboard.schema";
import type {
	DashboardDefinition,
	DashboardPanelDefinition,
	DashboardVariableDefinition,
} from "./types";

export function defineDashboard(
	input: DashboardDefinition,
): DashboardDefinition {
	const manifest = dashboardManifestSchema.parse(input.manifest);
	const variables = input.variables.map(
		(variable): DashboardVariableDefinition => ({
			manifest: variableManifestSchema.parse(variable.manifest),
			options: variable.options,
		}),
	);
	const panels = input.panels.map(
		(panel): DashboardPanelDefinition => ({
			manifest: panelManifestSchema.parse(panel.manifest),
			handler: panel.handler,
		}),
	);
	return { manifest, variables, panels };
}
