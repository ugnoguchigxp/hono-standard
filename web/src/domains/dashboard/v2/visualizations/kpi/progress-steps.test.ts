import { dashboardDataFrameV2Schema } from "@shared/schemas/dashboard.schema";
import { describe, expect, it } from "vitest";
import { buildProgressSteps, progressStepsSummary } from "./progress-steps";

const frame = dashboardDataFrameV2Schema.parse({
	schemaVersion: 2,
	refId: "A",
	source: { kind: "query", refId: "A" },
	name: "Deployment",
	fields: [
		{
			key: "step",
			label: "Step",
			type: "string",
			values: ["Build", "Test", "Deploy", "Verify"],
			roles: ["category"],
			labels: {},
		},
		{
			key: "state",
			label: "State",
			type: "string",
			values: ["completed", "completed", "current", "pending"],
			roles: ["state"],
			labels: {},
		},
	],
	meta: { shapeHint: "category" },
});

describe("progress steps", () => {
	it("builds ordered completed, current, and pending phases", () => {
		const model = buildProgressSteps(frame);
		expect(model.steps.map((step) => step.phase)).toEqual([
			"completed",
			"completed",
			"current",
			"pending",
		]);
		expect(progressStepsSummary(model, "Deployment")).toContain(
			"step 3 of 4, Deploy",
		);
	});

	it("rejects duplicate labels, multiple current steps, and invalid order", () => {
		const duplicate = dashboardDataFrameV2Schema.parse({
			...frame,
			fields: frame.fields.map((field) =>
				field.key === "step"
					? { ...field, values: ["Build", "Build", "Deploy", "Verify"] }
					: field,
			),
		});
		expect(buildProgressSteps(duplicate).error).toMatch(/unique/);

		const multiple = dashboardDataFrameV2Schema.parse({
			...frame,
			fields: frame.fields.map((field) =>
				field.key === "state"
					? { ...field, values: ["completed", "current", "current", "pending"] }
					: field,
			),
		});
		expect(buildProgressSteps(multiple).error).toMatch(/one current/);

		const invalidOrder = dashboardDataFrameV2Schema.parse({
			...frame,
			fields: frame.fields.map((field) =>
				field.key === "state"
					? { ...field, values: ["completed", "pending", "completed", "pending"] }
					: field,
			),
		});
		expect(buildProgressSteps(invalidOrder).error).toMatch(/precede/);
	});
});
