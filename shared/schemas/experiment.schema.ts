import { z } from "zod";
export const experimentStatusSchema = z.enum([
	"paused",
	"running",
	"completed",
	"dead",
	"failed",
	"interrupted",
]);
export const createExperimentSchema = z
	.object({
		seed: z.number().int().min(0).max(0xffffffff).default(1),
		scenario: z
			.enum(["food", "shelter", "mating", "competing", "risk"])
			.default("food"),
		configOverrides: z
			.record(z.string(), z.union([z.number().finite(), z.string()]))
			.default({}),
	})
	.strict();
export const controlSchema = z
	.object({
		commandId: z.string().min(1).max(128),
		expectedRevision: z.number().int().min(0),
		action: z.enum(["run", "pause", "step", "reset"]),
		speed: z
			.union([z.literal(0.1), z.literal(1), z.literal(10), z.literal(100)])
			.optional(),
	})
	.strict();
export type CreateExperimentInput = z.infer<typeof createExperimentSchema>;
export type ControlInput = z.infer<typeof controlSchema>;
