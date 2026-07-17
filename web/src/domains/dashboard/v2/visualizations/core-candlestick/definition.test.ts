import { describe, expect, it } from "vitest";
import { coreCandlestickDefinition } from "./definition";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";

describe("coreCandlestickDefinition", () => {
	it("should have correct capabilities and load properties", () => {
		expect(coreCandlestickDefinition.descriptor.capabilities.annotations).toBe(true);
		expect(coreCandlestickDefinition.loadPolicy).toBe("viewport");
	});

	it("should validateFrames correctly", () => {
		const emptyFrames: DashboardDataFrameV2[] = [];
		expect(coreCandlestickDefinition.validateFrames!(emptyFrames, {} as any, "default")).toBe(
			"Candlestick requires one OHLC frame",
		);

		const validFrame: DashboardDataFrameV2 = {
			schemaVersion: 2,
			refId: "A",
			source: { kind: "query", refId: "A" },
			name: "OHLC",
			fields: [
				{ key: "time", label: "Time", type: "time", values: [1], roles: ["time"], labels: {} },
				{ key: "open", label: "Open", type: "number", values: [10], roles: ["open"], labels: {} },
				{ key: "high", label: "High", type: "number", values: [15], roles: ["high"], labels: {} },
				{ key: "low", label: "Low", type: "number", values: [5], roles: ["low"], labels: {} },
				{ key: "close", label: "Close", type: "number", values: [12], roles: ["close"], labels: {} },
			],
			meta: { shapeHint: "ohlc" },
		};

		expect(coreCandlestickDefinition.validateFrames!([validFrame], {} as any, "default")).toBeUndefined();

		expect(coreCandlestickDefinition.validateFrames!([validFrame], {} as any, "volume")).toBe(
			"Volume preset requires volume",
		);

		const frameWithVolume: DashboardDataFrameV2 = {
			...validFrame,
			fields: [
				...validFrame.fields,
				{ key: "volume", label: "Volume", type: "number", values: [100], roles: ["volume"], labels: {} },
			],
		};
		expect(coreCandlestickDefinition.validateFrames!([frameWithVolume], {} as any, "volume")).toBeUndefined();
	});

	it("should validateResolvedFrames correctly", () => {
		const emptyFrames: DashboardDataFrameV2[] = [];
		expect(coreCandlestickDefinition.validateResolvedFrames!(emptyFrames, {} as any, "default", {} as any)).toBe(
			"Candlestick requires one OHLC frame",
		);

		const validFrame: DashboardDataFrameV2 = {
			schemaVersion: 2,
			refId: "A",
			source: { kind: "query", refId: "A" },
			name: "OHLC",
			fields: [
				{ key: "time", label: "Time", type: "time", values: [1], roles: ["time"], labels: {} },
				{ key: "open", label: "Open", type: "number", values: [10], roles: ["open"], labels: {} },
				{ key: "high", label: "High", type: "number", values: [15], roles: ["high"], labels: {} },
				{ key: "low", label: "Low", type: "number", values: [5], roles: ["low"], labels: {} },
				{ key: "close", label: "Close", type: "number", values: [12], roles: ["close"], labels: {} },
			],
			meta: { shapeHint: "ohlc" },
		};

		const spec: any = {
			fieldConfig: { unit: { kind: "currency", code: "USD" } },
			overrides: [],
		};

		expect(coreCandlestickDefinition.validateResolvedFrames!([validFrame], {} as any, "default", spec)).toBeUndefined();

		// test config yDomain domain min/max config error
		const configDomain: any = { yDomain: "config" };
		expect(coreCandlestickDefinition.validateResolvedFrames!([validFrame], configDomain, "default", spec)).toBe(
			"Configured OHLC domain requires field min and max",
		);

		// test unit mismatch
		const badFrame: DashboardDataFrameV2 = {
			...validFrame,
			fields: [
				{ key: "time", label: "Time", type: "time", values: [1], roles: ["time"], labels: {} },
				{ key: "open", label: "Open", type: "number", values: [10], roles: ["open"], labels: {}, config: { unit: { kind: "currency", code: "USD" } } },
				{ key: "high", label: "High", type: "number", values: [15], roles: ["high"], labels: {}, config: { unit: { kind: "currency", code: "EUR" } } },
				{ key: "low", label: "Low", type: "number", values: [5], roles: ["low"], labels: {} },
				{ key: "close", label: "Close", type: "number", values: [12], roles: ["close"], labels: {} },
			],
		};
		expect(coreCandlestickDefinition.validateResolvedFrames!([badFrame], {} as any, "default", spec)).toBe(
			"OHLC price fields require identical units",
		);
	});
});
