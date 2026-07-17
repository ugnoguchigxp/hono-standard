import { describe, expect, it } from "vitest";
import { geoMapDefinition } from "./definition";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";

describe("geoMapDefinition", () => {
	it("should have correct load properties", () => {
		expect(geoMapDefinition.loadPolicy).toBe("viewport");
	});

	it("should validateFrames correctly", () => {
		const emptyFrames: DashboardDataFrameV2[] = [];
		expect(geoMapDefinition.validateFrames!(emptyFrames, {} as any, "points")).toBe(
			"Geomap requires one geo frame",
		);

		const pointsFrame: DashboardDataFrameV2 = {
			schemaVersion: 2,
			refId: "A",
			source: { kind: "query", refId: "A" },
			name: "GeoPoints",
			fields: [
				{ key: "lat", label: "Latitude", type: "number", values: [35.6], roles: ["latitude"], labels: {} },
				{ key: "lon", label: "Longitude", type: "number", values: [139.6], roles: ["longitude"], labels: {} },
			],
			meta: { shapeHint: "geo" },
		};

		expect(geoMapDefinition.validateFrames!([pointsFrame], {} as any, "points")).toBeUndefined();

		expect(geoMapDefinition.validateFrames!([pointsFrame], {} as any, "regions")).toBe(
			"Regions preset requires region-id and value",
		);

		const regionsFrame: DashboardDataFrameV2 = {
			schemaVersion: 2,
			refId: "A",
			source: { kind: "query", refId: "A" },
			name: "GeoRegions",
			fields: [
				{ key: "region", label: "Region", type: "string", values: ["JP"], roles: ["region-id"], labels: {} },
				{ key: "value", label: "Value", type: "number", values: [100], roles: ["value"], labels: {} },
			],
			meta: { shapeHint: "geo" },
		};

		expect(geoMapDefinition.validateFrames!([regionsFrame], {} as any, "regions")).toBeUndefined();

		// test execution error (invalid coordinates)
		const invalidPointsFrame: DashboardDataFrameV2 = {
			schemaVersion: 2,
			refId: "A",
			source: { kind: "query", refId: "A" },
			name: "InvalidGeoPoints",
			fields: [
				{ key: "lat", label: "Latitude", type: "number", values: [undefined as never], roles: ["latitude"], labels: {} },
				{ key: "lon", label: "Longitude", type: "number", values: [139.6], roles: ["longitude"], labels: {} },
			],
			meta: { shapeHint: "geo" },
		};

		expect(geoMapDefinition.validateFrames!([invalidPointsFrame], {} as any, "points")).toBe(
			"geo coordinates must be finite",
		);
	});
});
