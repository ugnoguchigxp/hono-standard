import type {
	DashboardFieldRole,
	DashboardFieldType,
	FieldOverrideV2,
	StandardFieldConfigPatchV2,
	StandardFieldConfigV2,
} from "./field-config.schema";
import { standardFieldConfigV2Schema } from "./field-config.schema";

type ResolutionContext = {
	frameRefId: string;
	source:
		| { kind: "query"; refId: string }
		| { kind: "transformation"; id: string };
	fieldKey: string;
	fieldType: DashboardFieldType;
	fieldRoles: DashboardFieldRole[];
};

const matches = (
	matcher: FieldOverrideV2["matcher"],
	context: ResolutionContext,
): boolean => {
	switch (matcher.kind) {
		case "field-name":
			return matcher.fieldKey === context.fieldKey;
		case "field-type":
			return matcher.fieldType === context.fieldType;
		case "field-role":
			return context.fieldRoles.includes(matcher.role);
		case "field-regex":
			return new RegExp(matcher.pattern, matcher.flags).test(context.fieldKey);
		case "frame-ref":
			return matcher.refId === context.frameRefId;
		case "query-ref":
			return (
				context.source.kind === "query" &&
				matcher.refId === context.source.refId
			);
		case "transformation-ref":
			return (
				context.source.kind === "transformation" &&
				matcher.id === context.source.id
			);
	}
};

const mergeConfig = (
	base: StandardFieldConfigV2,
	patch: StandardFieldConfigPatchV2,
): StandardFieldConfigV2 => {
	const result: StandardFieldConfigV2 = { ...base, ...patch };
	if (patch.unit !== undefined) result.unit = patch.unit;
	if (patch.color !== undefined) result.color = patch.color;
	if (patch.thresholds !== undefined) result.thresholds = patch.thresholds;
	if (patch.valueMappings !== undefined)
		result.valueMappings = [...patch.valueMappings];
	if (patch.links !== undefined) result.links = [...patch.links];
	return standardFieldConfigV2Schema.parse(result);
};

export function resolveEffectiveFieldConfig(
	panelConfig: StandardFieldConfigV2,
	fieldConfig: StandardFieldConfigPatchV2 | undefined,
	overrides: FieldOverrideV2[],
	context: ResolutionContext,
): StandardFieldConfigV2 {
	let result = standardFieldConfigV2Schema.parse(panelConfig);
	if (fieldConfig) result = mergeConfig(result, fieldConfig);
	for (const override of overrides)
		if (matches(override.matcher, context))
			result = mergeConfig(result, override.properties);
	return result;
}
