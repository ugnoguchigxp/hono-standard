import { z } from "zod";
export const neuronDtoSchema = z.object({
	id: z.number().int().nonnegative(),
	type: z.enum(["excitatory", "inhibitory"]),
	role: z.enum(["sensory", "internal", "motor"]),
	position: z.object({ x: z.number().finite(), y: z.number().finite() }),
	potential: z.number().finite(),
	threshold: z.number().finite(),
	activity: z.number().finite(),
});
export const synapseDtoSchema = z.object({
	id: z.number().int().positive(),
	source: z.number().int().nonnegative(),
	target: z.number().int().nonnegative(),
	type: z.enum(["excitatory", "inhibitory"]),
	weight: z.number().min(0).max(1),
	delayMs: z.number().int().min(1).max(20),
});
export const brainInspectorSchema = z.object({
	neuron: neuronDtoSchema,
	incoming: z.array(synapseDtoSchema),
	outgoing: z.array(synapseDtoSchema),
});
