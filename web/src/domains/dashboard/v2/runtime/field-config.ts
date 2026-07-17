import {
	resolveEffectiveFieldConfig as resolveShared,
	type DashboardDataFrameV2,
	type PanelManifestV2,
	type StandardFieldConfigV2,
} from "@shared/schemas/dashboard.schema";
export function resolveFieldConfig(
	panel: Pick<PanelManifestV2, "visualization">,
	frame: DashboardDataFrameV2,
	field: DashboardDataFrameV2["fields"][number],
): StandardFieldConfigV2 {
	return resolveShared(
		panel.visualization.fieldConfig,
		field.config,
		panel.visualization.overrides,
		{
			frameRefId: frame.refId,
			source: frame.source,
			fieldKey: field.key,
			fieldType: field.type,
			fieldRoles: field.roles,
		},
	);
}
