import { describe, expect, it } from "vitest";
import { composedConfigV1Schema } from "@shared/schemas/dashboard/cartesian-visualizations.schema";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { buildComposedModel } from "./model";

const frames: DashboardDataFrameV2[] = [{ schemaVersion: 2, refId: "A", source: { kind: "query", refId: "A" }, name: "count", fields: [{ key: "time", label: "Time", type: "time", roles: ["time"], labels: {}, values: [1, 2] }, { key: "count", label: "Count", type: "number", roles: ["value"], labels: {}, values: [1, 2] }, { key: "latency", label: "Latency", type: "number", roles: ["value"], labels: {}, values: [10, 20] }], meta: { shapeHint: "timeseries" } }];

describe("composed model", () => {
	it("infers safe left/right bindings and accepts explicit bindings", () => {
		const inferred = buildComposedModel(frames, composedConfigV1Schema.parse({}));
		expect(inferred.bindings.map((item) => item.axis)).toEqual(["left", "right"]);
		const explicit = buildComposedModel(frames, composedConfigV1Schema.parse({ series: [{ fieldKey: "count", mark: "line", axis: "left" }, { fieldKey: "latency", mark: "bar", axis: "right" }] }));
		expect(explicit.bindings[1]?.mark).toBe("bar");
	});
	it("resolves unique multi-frame bindings and rejects ambiguous field keys", () => {
		const second = structuredClone(frames[0]!);
		second.refId = "B";
		second.source = { kind: "query", refId: "B" };
		const explicit = composedConfigV1Schema.parse({
			series: [
				{ fieldKey: "A:count", mark: "bar", axis: "left" },
				{ fieldKey: "B:latency", mark: "line", axis: "right" },
			],
		});
		expect(buildComposedModel([frames[0]!, second], explicit).bindings).toMatchObject([
			{ fieldKey: "A:count" },
			{ fieldKey: "B:latency" },
		]);
		const ambiguous = composedConfigV1Schema.parse({
			series: [
				{ fieldKey: "count", mark: "bar", axis: "left" },
				{ fieldKey: "latency", mark: "line", axis: "right" },
			],
		});
		expect(() => buildComposedModel([frames[0]!, second], ambiguous)).toThrow(
			/AMBIGUOUS/,
		);
	});
});
