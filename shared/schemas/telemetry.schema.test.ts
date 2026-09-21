import { expect, it } from "vitest";
import { telemetryEnvelopeSchema } from "./telemetry.schema";
it("requires telemetry envelope identity", () => {
	expect(
		telemetryEnvelopeSchema.safeParse({
			schemaVersion: 1,
			runId: "run",
			sequence: 0,
			simTimeMs: 0,
			status: "paused",
			topologyVersion: 0,
		}).success,
	).toBe(true);
	expect(telemetryEnvelopeSchema.safeParse({ schemaVersion: 2 }).success).toBe(
		false,
	);
});
