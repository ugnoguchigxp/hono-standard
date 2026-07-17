import type {
	DashboardDataFrameV2,
	DashboardColorToken,
} from "@shared/schemas/dashboard.schema";
import { stableToken } from "../composition/category-model";

export type ScatterPoint = {
	id: string;
	x: number;
	y: number;
	size: number | null;
	series: string;
	colorToken: DashboardColorToken;
	raw: Record<string, string | number | boolean | null>;
};
export type ScatterModel = {
	points: ScatterPoint[];
	skipped: number;
	groups: string[];
	hasSize: boolean;
	xRange: [number, number];
	yRange: [number, number];
};

const fieldByBinding = (
	frame: DashboardDataFrameV2,
	key: string | undefined,
	role: "x" | "y" | "size" | "series",
) => {
	const matches = key
		? frame.fields.filter((field) => field.key === key)
		: frame.fields.filter((field) => field.roles.includes(role));
	if (matches.length !== 1)
		throw new Error(
			key
				? "SCATTER_FIELD_NOT_FOUND_OR_AMBIGUOUS"
				: `SCATTER_${role.toUpperCase()}_ROLE_REQUIRED_EXACTLY_ONCE`,
		);
	return matches[0];
};

const optionalFieldByBinding = (
	frame: DashboardDataFrameV2,
	key: string | undefined,
	role: "size" | "series",
) => {
	const matches = key
		? frame.fields.filter((field) => field.key === key)
		: frame.fields.filter((field) => field.roles.includes(role));
	if (matches.length > 1)
		throw new Error(`SCATTER_${role.toUpperCase()}_FIELD_AMBIGUOUS`);
	if (key && matches.length !== 1)
		throw new Error("SCATTER_FIELD_NOT_FOUND_OR_AMBIGUOUS");
	return matches[0];
};

export function buildScatterModel(
	frame: DashboardDataFrameV2,
	options: {
		xFieldKey?: string;
		yFieldKey?: string;
		sizeFieldKey?: string;
		seriesFieldKey?: string;
		palette: readonly string[];
	},
) {
	const xField = fieldByBinding(frame, options.xFieldKey, "x");
	const yField = fieldByBinding(frame, options.yFieldKey, "y");
	const sizeField = optionalFieldByBinding(frame, options.sizeFieldKey, "size");
	const seriesField = optionalFieldByBinding(
		frame,
		options.seriesFieldKey,
		"series",
	);
	if (!xField || !yField) throw new Error("SCATTER_X_Y_REQUIRED");
	if (
		![xField, yField].every(
			(field) => field.type === "number" || field.type === "time",
		)
	)
		throw new Error("SCATTER_X_Y_MUST_BE_NUMERIC_OR_TIME");
	if (sizeField && sizeField.type !== "number")
		throw new Error("SCATTER_SIZE_MUST_BE_NUMERIC");
	const groups = new Set<string>();
	let skipped = 0;
	const points: ScatterPoint[] = [];
	for (let index = 0; index < xField.values.length; index += 1) {
		const x = xField.values[index];
		const y = yField.values[index];
		const size = sizeField?.values[index] ?? null;
		if (
			x === null ||
			y === null ||
			!Number.isFinite(Number(x)) ||
			!Number.isFinite(Number(y))
		) {
			skipped += 1;
			continue;
		}
		if (size !== null && (!Number.isFinite(Number(size)) || Number(size) < 0))
			throw new Error("SCATTER_SIZE_INVALID");
		if (sizeField && Number(size) === 0) {
			skipped += 1;
			continue;
		}
		const series =
			seriesField?.values[index] === null ||
			seriesField?.values[index] === undefined
				? frame.refId
				: String(seriesField.values[index]);
		groups.add(series);
		if (groups.size > 12) throw new Error("SCATTER_GROUP_LIMIT_EXCEEDED");
		points.push({
			id: `${frame.refId}:${index}`,
			x: Number(x),
			y: Number(y),
			size: size === null ? null : Number(size),
			series,
			colorToken: stableToken(series, options.palette),
			raw: Object.fromEntries(
				frame.fields.map((field) => [field.key, field.values[index] ?? null]),
			) as ScatterPoint["raw"],
		});
	}
	if (points.length > (sizeField ? 500 : 1000))
		throw new Error("SCATTER_POINT_LIMIT_EXCEEDED");
	if (points.length === 0) throw new Error("SCATTER_NO_VALID_POINTS");
	return {
		points,
		skipped,
		groups: [...groups],
		hasSize: !!sizeField,
		xRange: [
			Math.min(...points.map((point) => point.x)),
			Math.max(...points.map((point) => point.x)),
		] as [number, number],
		yRange: [
			Math.min(...points.map((point) => point.y)),
			Math.max(...points.map((point) => point.y)),
		] as [number, number],
	} satisfies ScatterModel;
}
