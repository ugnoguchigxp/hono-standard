import { z } from "zod";
export const telemetryEnvelopeSchema = z
	.object({
		schemaVersion: z.literal(1),
		runId: z.string().min(1),
		sequence: z.number().int().nonnegative(),
		simTimeMs: z.number().int().nonnegative(),
		status: z.enum([
			"paused",
			"running",
			"completed",
			"dead",
			"failed",
			"interrupted",
		]),
		topologyVersion: z.number().int().nonnegative(),
	})
	.passthrough();
