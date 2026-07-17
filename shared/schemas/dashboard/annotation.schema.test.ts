import { describe, expect, it } from "vitest";
import { annotationLayerSpecsSchema, annotationLayerSpecV1Schema } from "./annotation.schema";

describe("annotation layer contract", () => {
	it("defaults optional display controls and rejects unsafe configuration", () => {
		expect(annotationLayerSpecV1Schema.parse({ id: "deploys", frameRef: "B", mode: "region", name: "Deployments" })).toMatchObject({ enabled: true, severityFilter: [], showLabel: "always" });
		expect(annotationLayerSpecsSchema.safeParse([{ id: "same", frameRef: "A", mode: "point", name: "A" }, { id: "same", frameRef: "B", mode: "line", name: "B" }]).success).toBe(false);
		expect(annotationLayerSpecV1Schema.safeParse({ id: "bad", frameRef: "A", mode: "point", name: "A", colorToken: "red" }).success).toBe(false);
	});
});
