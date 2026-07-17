import { clampGeometry } from "./range";

export type Point = { x: number; y: number };

export function polarPoint(
	angleDegrees: number,
	radius = 1,
	center = 0.5,
): Point {
	const radians = (angleDegrees * Math.PI) / 180;
	return {
		x: center + Math.cos(radians) * radius,
		y: center + Math.sin(radians) * radius,
	};
}

export function arcPath(
	startAngle: number,
	endAngle: number,
	radius = 0.42,
	center = 0.5,
): string {
	const start = polarPoint(startAngle, radius, center);
	const end = polarPoint(endAngle, radius, center);
	const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
	const sweep = endAngle >= startAngle ? 1 : 0;
	return `M ${start.x.toFixed(5)} ${start.y.toFixed(5)} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x.toFixed(5)} ${end.y.toFixed(5)}`;
}

export function valueArcPath(
	value: number,
	startAngle: number,
	endAngle: number,
	radius = 0.42,
) {
	const clamped = clampGeometry(value);
	return arcPath(
		startAngle,
		startAngle + (endAngle - startAngle) * clamped,
		radius,
	);
}

export function sparklinePoints(
	values: Array<number | null>,
	width = 100,
	height = 24,
): string {
	const finite = values.filter(
		(item): item is number => typeof item === "number" && Number.isFinite(item),
	);
	if (!finite.length) return "";
	const min = Math.min(...finite);
	const max = Math.max(...finite);
	const denominator = max === min ? 1 : max - min;
	return values
		.map((value, index) => {
			if (value === null || !Number.isFinite(value)) return "";
			const x =
				values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
			const y = height - ((value - min) / denominator) * height;
			return `${x.toFixed(2)},${y.toFixed(2)}`;
		})
		.filter(Boolean)
		.join(" ");
}

export function segmentCount(normalized: number, count: number): number {
	return normalized >= 1
		? count
		: Math.floor(clampGeometry(normalized) * count);
}
