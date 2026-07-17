import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { SPECIALIZED_LIMITS } from "../specialized/limits";
import {
	fieldFor,
	numberAt,
	rowCount,
	stringAt,
} from "../specialized/frame-values";
import {
	projectEquirectangular,
	projectGreatCircleRoute,
	type ProjectedSegment,
} from "./projection";
import { sanitizeDisplayText } from "../specialized/text";
import { WORLD_110M_REGION_IDS } from "./assets/world-110m.region-ids";

export type GeoPoint = {
	latitude: number;
	longitude: number;
	label?: string;
	value?: number;
	category?: string;
	x: number;
	y: number;
	index: number;
};
export type GeoRoute = {
	source: GeoPoint;
	target: GeoPoint;
	value?: number;
	label?: string;
	index: number;
	segments: ProjectedSegment[];
};
export type GeoRegion = {
	id: string;
	label: string;
	value: number;
	index: number;
};

const worldRegionIds = new Set<string>(WORLD_110M_REGION_IDS);

export function buildGeoModel(
	frame: DashboardDataFrameV2,
	preset: string,
	width = 720,
	height = 360,
	clusterCellPx = 32,
) {
	const points: GeoPoint[] = [];
	const lat = fieldFor(frame, "latitude");
	const lon = fieldFor(frame, "longitude");
	const label = fieldFor(frame, "label");
	const value = fieldFor(frame, "value");
	const category = fieldFor(frame, "category");
	if (preset === "regions") {
		const region = fieldFor(frame, "region-id");
		if (!region || !value)
			throw new Error("regions require region-id and value");
		if (rowCount(frame) > SPECIALIZED_LIMITS.maxGeoRegions)
			throw new Error("geo region limit exceeded");
		const regionIds = new Set<string>();
		const regions: GeoRegion[] = [];
		for (let index = 0; index < rowCount(frame); index += 1) {
			const regionId = stringAt(region, index).toUpperCase();
			if (regionIds.has(regionId))
				throw new Error("geo region IDs must be unique");
			regionIds.add(regionId);
			if (!worldRegionIds.has(regionId))
				throw new Error("unknown geo region id");
			const regionValue = numberAt(value, index);
			if (regionValue === undefined)
				throw new Error("geo region value must be finite");
			regions.push({
				id: regionId,
				label: label
					? sanitizeDisplayText(stringAt(label, index, regionId))
					: regionId,
				value: regionValue,
				index,
			});
		}
		return { points, routes: [], regions, clusters: [], notices: [] };
	}
	if (preset === "routes") {
		const sourceLat = fieldFor(frame, "source-latitude");
		const sourceLon = fieldFor(frame, "source-longitude");
		const targetLat = fieldFor(frame, "target-latitude");
		const targetLon = fieldFor(frame, "target-longitude");
		if (!sourceLat || !sourceLon || !targetLat || !targetLon)
			throw new Error("routes require source and target coordinates");
		if (rowCount(frame) > SPECIALIZED_LIMITS.maxGeoRoutes)
			throw new Error("geo route limit exceeded");
		const routes: GeoRoute[] = [];
		for (let index = 0; index < rowCount(frame); index += 1) {
			const source = point(
				numberAt(sourceLat, index),
				numberAt(sourceLon, index),
				width,
				height,
				index,
			);
			const target = point(
				numberAt(targetLat, index),
				numberAt(targetLon, index),
				width,
				height,
				index,
			);
			const routeValue = numberAt(value, index);
			if (routeValue !== undefined && routeValue < 0)
				throw new Error("geo route value must be non-negative");
			routes.push({
				source,
				target,
				value: routeValue,
				label: label
					? sanitizeDisplayText(stringAt(label, index)) || undefined
					: undefined,
				index,
				segments: projectGreatCircleRoute(source, target, width, height),
			});
		}
		return { points: [], routes, regions: [], clusters: [], notices: [] };
	}
	if (!lat || !lon)
		throw new Error("geo points require latitude and longitude");
	for (let index = 0; index < rowCount(frame); index += 1)
		points.push({
			...point(
				numberAt(lat, index),
				numberAt(lon, index),
				width,
				height,
				index,
			),
			label: label
				? sanitizeDisplayText(stringAt(label, index)) || undefined
				: undefined,
			value: numberAt(value, index),
			category: category
				? sanitizeDisplayText(stringAt(category, index)) || undefined
				: undefined,
		});
	const pointLimit =
		preset === "clusters"
			? SPECIALIZED_LIMITS.maxGeoClusterInputs
			: SPECIALIZED_LIMITS.maxGeoPoints;
	if (points.length > pointLimit) throw new Error("geo point limit exceeded");
	const clusters =
		preset === "clusters" ? clusterPoints(points, clusterCellPx) : [];
	return {
		points,
		routes: [],
		regions: [],
		clusters,
		notices: clusters.length < points.length ? ["dense points clustered"] : [],
	};
}

function point(
	latitude: number | undefined,
	longitude: number | undefined,
	width: number,
	height: number,
	index: number,
): GeoPoint {
	if (latitude === undefined || longitude === undefined)
		throw new Error("geo coordinates must be finite");
	const projected = projectEquirectangular(latitude, longitude, width, height);
	return { latitude, longitude, x: projected.x, y: projected.y, index };
}

export function clusterPoints(points: GeoPoint[], cellSize: number) {
	if (!Number.isFinite(cellSize) || cellSize <= 0)
		throw new Error("cluster cell size must be positive");
	const buckets = new Map<string, GeoPoint[]>();
	for (const item of points) {
		const key = `${Math.floor(item.x / cellSize)}:${Math.floor(item.y / cellSize)}`;
		buckets.set(key, [...(buckets.get(key) ?? []), item]);
	}
	return [...buckets.values()].map((items) => ({
		x: items.reduce((sum, item) => sum + item.x, 0) / items.length,
		y: items.reduce((sum, item) => sum + item.y, 0) / items.length,
		count: items.length,
		labels: items.map((item) => item.label).filter(Boolean) as string[],
		points: items,
	}));
}
