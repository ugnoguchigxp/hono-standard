import type {
	DashboardDataFrameV2,
	DashboardColorToken,
	StandardFieldConfigV2,
} from "@shared/schemas/dashboard.schema";
import { standardFieldConfigV2Schema } from "@shared/schemas/dashboard.schema";

export type CategorySlice = {
	id: string;
	label: string;
	rawCategory: string | null;
	value: number;
	percent: number;
	colorToken: DashboardColorToken;
	raw: Record<string, string | number | boolean | null>;
};
export type CategoryCompositionModel = {
	slices: CategorySlice[];
	total: number;
	valueFieldConfig: StandardFieldConfigV2;
};

export const paletteIndex = (key: string, paletteLength: number) => {
	if (paletteLength <= 0) return 0;
	let hash = 0x811c9dc5;
	for (let index = 0; index < key.length; index += 1) {
		hash ^= key.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0) % paletteLength;
};

export function stableToken(
	key: string,
	palette: readonly string[],
): DashboardColorToken {
	return (palette[paletteIndex(key, palette.length)] ??
		"--color-brand") as DashboardColorToken;
}

function rawRow(frame: DashboardDataFrameV2, index: number) {
	return Object.fromEntries(
		frame.fields.map((field) => [field.key, field.values[index] ?? null]),
	) as Record<string, string | number | boolean | null>;
}

export function buildCategoryCompositionModel(
	frame: DashboardDataFrameV2,
	palette: readonly string[],
): CategoryCompositionModel {
	const categoryFields = frame.fields.filter((field) =>
		field.roles.includes("category"),
	);
	const valueFields = frame.fields.filter(
		(field) => field.type === "number" && field.roles.includes("value"),
	);
	if (categoryFields.length !== 1)
		throw new Error("CATEGORY_FIELD_REQUIRED_EXACTLY_ONCE");
	if (valueFields.length !== 1)
		throw new Error("VALUE_FIELD_REQUIRED_EXACTLY_ONCE");
	const category = categoryFields[0];
	const valueField = valueFields[0];
	if (!category || !valueField) throw new Error("CATEGORY_VALUE_FIELD_MISSING");
	const ids = new Set<string>();
	const slices = category.values.map((rawCategory, index) => {
		const categoryText = rawCategory === null ? null : String(rawCategory);
		const id = categoryText === null ? "__null__" : categoryText;
		if (ids.has(id)) throw new Error("CATEGORY_DUPLICATE");
		ids.add(id);
		const value = valueField.values[index];
		if (value === null) throw new Error("CATEGORY_VALUE_NULL");
		if (typeof value !== "number")
			throw new Error("CATEGORY_VALUE_NOT_NUMERIC");
		if (!Number.isFinite(value)) throw new Error("CATEGORY_VALUE_NOT_FINITE");
		if (value < 0) throw new Error("CATEGORY_VALUE_NEGATIVE");
		return {
			id,
			label: categoryText ?? "No value",
			rawCategory: categoryText,
			value,
			percent: 0,
			colorToken: stableToken(id, palette),
			raw: rawRow(frame, index),
		};
	});
	if (slices.length === 0) throw new Error("CATEGORY_EMPTY");
	if (slices.length > 24) throw new Error("CATEGORY_SLICE_LIMIT_EXCEEDED");
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	if (!(total > 0)) throw new Error("CATEGORY_TOTAL_MUST_BE_POSITIVE");
	return {
		slices: slices.map((slice) => ({
			...slice,
			percent: (slice.value / total) * 100,
		})),
		total,
		valueFieldConfig: standardFieldConfigV2Schema.parse(
			valueField.config ?? {},
		),
	};
}

export function sortCategorySlices(
	model: CategoryCompositionModel,
	sort: "none" | "ascending" | "descending",
) {
	if (sort === "none") return model.slices;
	return [...model.slices].sort((left, right) =>
		sort === "ascending" ? left.value - right.value : right.value - left.value,
	);
}

export function visibleCategorySlices(
	model: CategoryCompositionModel,
	hiddenIds: ReadonlySet<string>,
) {
	const slices = model.slices.filter((slice) => !hiddenIds.has(slice.id));
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	return {
		slices: slices.map((slice) => ({
			...slice,
			percent: total > 0 ? (slice.value / total) * 100 : 0,
		})),
		total,
	};
}
