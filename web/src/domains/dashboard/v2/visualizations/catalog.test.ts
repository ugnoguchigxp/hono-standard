import { describe, expect, it } from "vitest";
import { tableFrame, tablePanel } from "../test/fixtures";
import { coreVisualizationCatalog } from "./catalog";
import { coreBarDefinition } from "./core-bar/definition";
import { coreComposedDefinition } from "./core-composed/definition";
import { coreTimeseriesDefinition } from "./core-timeseries/definition";

function timeseriesFrame(value: number) {
	const frame = tableFrame([{ name: "point", value }]);
	frame.fields[0] = {
		key: "time",
		label: "Time",
		type: "time",
		roles: ["time"],
		labels: {},
		values: [Date.UTC(2026, 0, 1)],
	};
	return frame;
}

describe("core visualization catalog", () => {
	it("registers the core renderers", () => {
		expect(coreVisualizationCatalog.map((item) => item.descriptor.type)).toEqual(
			[
				"core.timeseries", "core.bar", "core.composed", "core.stat", "core.table",
				"core.pie", "core.radar", "core.radial-bar", "core.scatter", "core.funnel",
				"core.treemap", "core.sunburst", "core.sankey", "core.gauge", "core.bar-gauge",
				"core.bullet", "core.progress", "core.traffic-light", "core.histogram",
				"core.heatmap", "core.box-plot", "core.calendar-heatmap",
				"core.state-timeline", "core.status-history", "core.uptime-grid",
				"core.node-graph", "core.candlestick", "observability.logs",
				"observability.trace-waterfall", "observability.flame-graph", "geo.map",
			],
		);
		expect(
			coreVisualizationCatalog.every((item) => typeof item.load === "function"),
		).toBe(true);
	});

	it("validates cartesian axes and rejects non-positive log values", () => {
		const invalidAxes = { valueAxis: { min: 2, max: 1 } };
		expect(
			coreTimeseriesDefinition.configSchema.safeParse(invalidAxes).success,
		).toBe(false);
		expect(coreBarDefinition.configSchema.safeParse(invalidAxes).success).toBe(
			false,
		);
		const negative = timeseriesFrame(-1);
		const positive = timeseriesFrame(1);
		const timeseriesConfig = coreTimeseriesDefinition.configSchema.parse({
			valueAxis: { scale: "log" },
		});
		expect(
			coreTimeseriesDefinition.validateFrames?.([negative], timeseriesConfig, "line"),
		).toMatch(/positive/);
		expect(
			coreTimeseriesDefinition.validateFrames?.([positive], timeseriesConfig, "line"),
		).toBeUndefined();
		const barConfig = coreBarDefinition.configSchema.parse({
			valueAxis: { scale: "log" },
		});
		const negativeBar = tableFrame([{ name: "negative", value: -1 }]);
		const positiveBar = tableFrame([{ name: "positive", value: 1 }]);
		expect(
			coreBarDefinition.validateFrames?.([negativeBar], barConfig, "vertical"),
		).toMatch(/positive/);
		expect(
			coreBarDefinition.validateFrames?.([positiveBar], barConfig, "vertical"),
		).toBeUndefined();
		const composed = tableFrame([{ name: "a", value: 1 }]);
		composed.fields.push({
			key: "latency",
			label: "Latency",
			type: "number",
			roles: ["value"],
			labels: {},
			values: [10],
		});
		expect(
			coreComposedDefinition.validateFrames?.(
				[composed],
				coreComposedDefinition.configSchema.parse({}),
				"dual-axis",
			),
		).toBeUndefined();
	});
	it("rejects invalid Cartesian domains before loading a renderer", () => {
		const duplicate = tableFrame([
			{ name: "api", value: 1 },
			{ name: "api", value: 2 },
		]);
		expect(
			coreBarDefinition.validateFrames?.(
				[duplicate],
				coreBarDefinition.configSchema.parse({}),
				"vertical",
			),
		).toMatch(/unique/);
		duplicate.fields[0] = {
			key: "time",
			label: "Time",
			type: "time",
			roles: ["time"],
			labels: {},
			values: [1, Number.NaN],
		};
		expect(
			coreTimeseriesDefinition.validateFrames?.(
				[duplicate],
				coreTimeseriesDefinition.configSchema.parse({}),
				"line",
			),
		).toMatch(/finite/);
	});
	it("enforces preset-specific percent and range rules", () => {
		const first = timeseriesFrame(1);
		const firstValue = first.fields[1];
		expect(firstValue).toBeDefined();
		if (!firstValue) return;
		firstValue.key = "lower";
		const second = structuredClone(first);
		second.refId = "B";
		second.source = { kind: "query", refId: "B" };
		const secondValue = second.fields[1];
		expect(secondValue).toBeDefined();
		if (!secondValue) return;
		secondValue.key = "upper";
		const rangeConfig = coreTimeseriesDefinition.configSchema.parse({
			rangeBand: { lowerFieldKey: "lower", upperFieldKey: "upper" },
		});
		expect(
			coreTimeseriesDefinition.validateFrames?.(
				[first, second],
				rangeConfig,
				"range-band",
			),
		).toMatch(/same frame/);

		const percentConfig = coreTimeseriesDefinition.configSchema.parse({
			valueAxis: { min: 1 },
		});
		expect(
			coreTimeseriesDefinition.validateFrames?.(
				[first, second],
				percentConfig,
				"percent-stacked-area",
			),
		).toMatch(/automatic/);
	});
	it("validates effective units for each Cartesian family", () => {
		const frame = timeseriesFrame(1);
		frame.fields.push({
			key: "latency",
			label: "Latency",
			type: "number",
			roles: ["value"],
			labels: {},
			values: [2],
			config: { unit: { kind: "duration", unit: "ms" } },
		});
		const spec = tablePanel().visualization;
		expect(
			coreTimeseriesDefinition.validateResolvedFrames?.(
				[frame],
				coreTimeseriesDefinition.configSchema.parse({}),
				"line",
				spec,
			),
		).toMatch(/consistent units/);

		const category = structuredClone(frame);
		category.fields[0] = {
			key: "name",
			label: "Name",
			type: "string",
			roles: ["category"],
			labels: {},
			values: ["api"],
		};
		expect(
			coreBarDefinition.validateResolvedFrames?.(
				[category],
				coreBarDefinition.configSchema.parse({}),
				"grouped",
				spec,
			),
		).toMatch(/consistent units/);
		expect(
			coreComposedDefinition.validateResolvedFrames?.(
				[frame],
				coreComposedDefinition.configSchema.parse({}),
				"dual-axis",
				spec,
			),
		).toBeUndefined();
	});
});
