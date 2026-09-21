import { expect, it } from "vitest";
import { brainInspectorSchema } from "./brain.schema";
it("validates public brain inspector DTOs", () => {
	expect(
		brainInspectorSchema.safeParse({
			neuron: {
				id: 0,
				type: "excitatory",
				role: "internal",
				position: { x: 0, y: 0 },
				potential: 0,
				threshold: 1,
				activity: 0,
			},
			incoming: [],
			outgoing: [],
		}).success,
	).toBe(true);
	expect(
		brainInspectorSchema.safeParse({
			neuron: { id: -1 },
			incoming: [],
			outgoing: [],
		}).success,
	).toBe(false);
});
