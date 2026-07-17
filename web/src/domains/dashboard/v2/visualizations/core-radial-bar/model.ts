import type {
	DashboardColorToken,
	DashboardDataFrameV2,
	StandardFieldConfigV2,
} from "@shared/schemas/dashboard.schema";
import { standardFieldConfigV2Schema } from "@shared/schemas/dashboard.schema";
import { stableToken } from "../composition/category-model";

export type RadialBarSlice = {
	id: string;
	label: string;
	value: number;
	colorToken: DashboardColorToken;
	raw: Record<string, string | number | boolean | null>;
};

export type RadialBarModel = {
	slices: RadialBarSlice[];
	valueFieldConfig: StandardFieldConfigV2;
};

const rawRow = (frame: DashboardDataFrameV2, index: number) =>
	Object.fromEntries(
		frame.fields.map((field) => [field.key, field.values[index] ?? null]),
	) as RadialBarSlice["raw"];

export function buildRadialBarModel(
	frame: DashboardDataFrameV2,
	palette: readonly string[],
	options: { allowAllZero: boolean },
): RadialBarModel {
	const categoryFields = frame.fields.filter((field) =>
		field.roles.includes("category"),
	);
	const valueFields = frame.fields.filter(
		(field) => field.type === "number" && field.roles.includes("value"),
	);
	if (categoryFields.length > 1)
		throw new Error("RADIAL_CATEGORY_FIELD_AMBIGUOUS");
	if (valueFields.length !== 1)
		throw new Error("RADIAL_VALUE_FIELD_REQUIRED_EXACTLY_ONCE");
	const categoryField = categoryFields[0];
	const valueField = valueFields[0];
	if (!valueField) throw new Error("RADIAL_VALUE_FIELD_MISSING");
	if (!categoryField && frame.meta.shapeHint !== "scalar")
		throw new Error("RADIAL_CATEGORY_FIELD_REQUIRED");
	if (!categoryField && valueField.values.length !== 1)
		throw new Error("RADIAL_SCALAR_REQUIRES_ONE_VALUE");
	if (valueField.values.length === 0) throw new Error("RADIAL_VALUE_REQUIRED");
	if (valueField.values.length > 20)
		throw new Error("RADIAL_CATEGORY_LIMIT_EXCEEDED");

	const ids = new Set<string>();
	const slices = valueField.values.map((rawValue, index) => {
		if (
			rawValue === null ||
			typeof rawValue !== "number" ||
			!Number.isFinite(rawValue) ||
			rawValue < 0
		)
			throw new Error("RADIAL_VALUE_MUST_BE_FINITE_AND_NON_NEGATIVE");
		const category = categoryField?.values[index];
		if (categoryField && category === null)
			throw new Error("RADIAL_CATEGORY_VALUE_REQUIRED");
		const id = categoryField
			? String(category)
			: `${frame.refId}:${valueField.key}`;
		if (ids.has(id)) throw new Error("RADIAL_CATEGORY_DUPLICATE");
		ids.add(id);
		return {
			id,
			label: categoryField
				? String(category)
				: (valueField.config?.displayName ?? valueField.label),
			value: rawValue,
			colorToken: stableToken(id, palette),
			raw: rawRow(frame, index),
		};
	});
	if (!options.allowAllZero && !slices.some((slice) => slice.value > 0))
		throw new Error("RADIAL_TOTAL_MUST_BE_POSITIVE");
	return {
		slices,
		valueFieldConfig: standardFieldConfigV2Schema.parse(
			valueField.config ?? {},
		),
	};
}

export function resolveRadialBarMax(
	model: RadialBarModel,
	configuredMax: "auto" | number,
	preset: string,
): number {
	const effectiveMax =
		typeof configuredMax === "number"
			? configuredMax
			: model.valueFieldConfig.max;
	if (preset === "progress" && !(effectiveMax && effectiveMax > 0))
		throw new Error("RADIAL_PROGRESS_MAX_REQUIRED");
	return (
		effectiveMax ?? Math.max(...model.slices.map((slice) => slice.value), 1)
	);
}
