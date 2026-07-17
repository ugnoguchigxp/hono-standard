import { describe, expect, it } from "vitest";
import { observabilityFlameGraphDefinition } from "./definition";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";

describe("observabilityFlameGraphDefinition", () => {
	it("should have correct load properties", () => {
		expect(observabilityFlameGraphDefinition.loadPolicy).toBe("viewport");
	});

	it("should validateFrames correctly", () => {
		const emptyFrames: DashboardDataFrameV2[] = [];
		expect(observabilityFlameGraphDefinition.validateFrames!(emptyFrames, {} as any, "default")).toBe(
			"Flame graph requires one profile frame",
		);

		const validFrame: DashboardDataFrameV2 = {
			schemaVersion: 2,
			refId: "A",
			source: { kind: "query", refId: "A" },
			name: "Profile",
			fields: [
				{ key: "id", label: "ID", type: "string", values: ["root"], roles: ["id"], labels: {} },
				{ key: "parent", label: "Parent", type: "string", values: [null], roles: ["parent-id"], labels: {} },
				{ key: "label", label: "Label", type: "string", values: ["root"], roles: ["label"], labels: {} },
				{ key: "total", label: "Total", type: "number", values: [100], roles: ["total"], labels: {} },
				{ key: "self", label: "Self", type: "number", values: [100], roles: ["self"], labels: {} },
			],
			meta: { shapeHint: "profile" },
		};

		expect(observabilityFlameGraphDefinition.validateFrames!([validFrame], {} as any, "default")).toBeUndefined();

		// test differential preset (missing delta)
		expect(observabilityFlameGraphDefinition.validateFrames!([validFrame], {} as any, "differential")).toBe(
			"Differential preset requires delta",
		);

		// test category-colored preset (missing category)
		expect(observabilityFlameGraphDefinition.validateFrames!([validFrame], {} as any, "category-colored")).toBe(
			"Category-colored preset requires category",
		);

		// test differential preset with valid delta
		const diffFrame: DashboardDataFrameV2 = {
			...validFrame,
			fields: [
				...validFrame.fields,
				{ key: "delta", label: "Delta", type: "number", values: [10], roles: ["delta"], labels: {} },
			],
		};
		expect(observabilityFlameGraphDefinition.validateFrames!([diffFrame], {} as any, "differential")).toBeUndefined();

		// test category-colored preset with valid category
		const categoryFrame: DashboardDataFrameV2 = {
			...validFrame,
			fields: [
				...validFrame.fields,
				{ key: "category", label: "Category", type: "string", values: ["render"], roles: ["category"], labels: {} },
			],
		};
		expect(observabilityFlameGraphDefinition.validateFrames!([categoryFrame], {} as any, "category-colored")).toBeUndefined();

		// test execution error (invalid hierarchy)
		const invalidFrame: DashboardDataFrameV2 = {
			schemaVersion: 2,
			refId: "A",
			source: { kind: "query", refId: "A" },
			name: "InvalidProfile",
			fields: [
				{ key: "id", label: "ID", type: "string", values: ["root", "child"], roles: ["id"], labels: {} },
				{ key: "parent", label: "Parent", type: "string", values: ["child", "root"], roles: ["parent-id"], labels: {} }, // cycle
				{ key: "label", label: "Label", type: "string", values: ["root", "child"], roles: ["label"], labels: {} },
				{ key: "total", label: "Total", type: "number", values: [100, 50], roles: ["total"], labels: {} },
				{ key: "self", label: "Self", type: "number", values: [50, 50], roles: ["self"], labels: {} },
			],
			meta: { shapeHint: "profile" },
		};
		expect(observabilityFlameGraphDefinition.validateFrames!([invalidFrame], {} as any, "default")).toBe(
			"profile contains orphan",
		);
	});
});
