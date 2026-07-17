import { clamp } from "../specialized/limits";

export type ProjectedPoint = { x: number; y: number };
export type ProjectedSegment = [ProjectedPoint, ProjectedPoint];

export function projectEquirectangular(
	latitude: number,
	longitude: number,
	width: number,
	height: number,
): ProjectedPoint {
	if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
		throw new Error("latitude must be between -90 and 90");
	if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
		throw new Error("longitude must be between -180 and 180");
	return {
		x: ((longitude + 180) / 360) * width,
		y: ((90 - latitude) / 180) * height,
	};
}

export function splitAntimeridian(
	a: ProjectedPoint,
	b: ProjectedPoint,
	width: number,
): ProjectedSegment[] {
	if (Math.abs(a.x - b.x) <= width / 2) return [[a, b]];
	const aIsLeft = a.x < b.x;
	const left = aIsLeft ? a : b;
	const right = aIsLeft ? b : a;
	const ratio =
		width - right.x + left.x === 0
			? 0.5
			: (width - right.x) / (width - right.x + left.x);
	const y = left.y + (right.y - left.y) * clamp(ratio, 0, 1);
	return aIsLeft
		? [
				[left, { x: 0, y }],
				[{ x: width, y }, right],
			]
		: [
				[right, { x: width, y }],
				[{ x: 0, y }, left],
			];
}

type GeographicPoint = { latitude: number; longitude: number };

export function projectGreatCircleRoute(
	source: GeographicPoint,
	target: GeographicPoint,
	width: number,
	height: number,
	segmentCount = 32,
): ProjectedSegment[] {
	if (!Number.isInteger(segmentCount) || segmentCount < 1 || segmentCount > 128)
		throw new Error("route segment count is invalid");
	const vector = ({ latitude, longitude }: GeographicPoint) => {
		const latitudeRadians = (latitude * Math.PI) / 180;
		const longitudeRadians = (longitude * Math.PI) / 180;
		const cosLatitude = Math.cos(latitudeRadians);
		return [
			cosLatitude * Math.cos(longitudeRadians),
			cosLatitude * Math.sin(longitudeRadians),
			Math.sin(latitudeRadians),
		] as const;
	};
	const start = vector(source);
	const finish = vector(target);
	const dot = clamp(
		start[0] * finish[0] + start[1] * finish[1] + start[2] * finish[2],
		-1,
		1,
	);
	const angle = Math.acos(dot);
	if (Math.abs(Math.PI - angle) < 1e-7)
		throw new Error("antipodal geo route is not supported");
	const sinAngle = Math.sin(angle);
	const projected: ProjectedPoint[] = [];
	for (let index = 0; index <= segmentCount; index += 1) {
		const ratio = index / segmentCount;
		let x: number;
		let y: number;
		let z: number;
		if (angle < 1e-9) {
			[x, y, z] = start;
		} else {
			const startWeight = Math.sin((1 - ratio) * angle) / sinAngle;
			const endWeight = Math.sin(ratio * angle) / sinAngle;
			x = startWeight * start[0] + endWeight * finish[0];
			y = startWeight * start[1] + endWeight * finish[1];
			z = startWeight * start[2] + endWeight * finish[2];
		}
		const length = Math.hypot(x, y, z);
		const latitude = (Math.asin(clamp(z / length, -1, 1)) * 180) / Math.PI;
		const longitude = (Math.atan2(y, x) * 180) / Math.PI;
		projected.push(projectEquirectangular(latitude, longitude, width, height));
	}
	return projected.slice(1).flatMap((point, index) => {
		const previous = projected[index];
		return previous ? splitAntimeridian(previous, point, width) : [];
	});
}
