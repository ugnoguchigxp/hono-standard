import { describe, expect, it } from "vitest";
import {
	createGameCorrelationId,
	createGameDiagnosticRecord,
	gameDiagnosticDurationBucket,
	gameDiagnosticRecordSchema,
} from "./diagnostics";

describe("game diagnostics contract", () => {
	it("creates a bounded vendor-neutral record", () => {
		expect(
			createGameDiagnosticRecord({
				event: "runtime.error",
				correlationId: "rpg-001122aabbcc",
				code: "asset.failed",
				mode: "field",
				mapId: "signal-ruins",
				occurredAt: "2026-08-11T00:00:00.000Z",
			}),
		).toEqual({
			version: 1,
			event: "runtime.error",
			correlationId: "rpg-001122aabbcc",
			code: "asset.failed",
			mode: "field",
			mapId: "signal-ruins",
			occurredAt: "2026-08-11T00:00:00.000Z",
		});
	});

	it("generates a valid correlation ID and supplies the current timestamp", () => {
		expect(createGameCorrelationId()).toMatch(/^rpg-[0-9a-f]{12}$/);
		const record = createGameDiagnosticRecord({
			event: "runtime.start",
			correlationId: "rpg-001122aabbcc",
		});
		expect(Number.isNaN(Date.parse(record.occurredAt))).toBe(false);
		expect(Object.isFrozen(record)).toBe(true);
	});

	it.each([
		[0, "lt-50"],
		[50, "50-99"],
		[100, "100-249"],
		[250, "250-999"],
		[1_000, "gte-1000"],
	] as const)("buckets %dms as %s", (durationMs, expected) => {
		expect(gameDiagnosticDurationBucket(durationMs)).toBe(expected);
	});

	it("rejects a record larger than the transport limit", () => {
		expect(() =>
			createGameDiagnosticRecord({
				event: "runtime.error",
				correlationId: "rpg-001122aabbcc",
				code: "a".repeat(2_048),
				occurredAt: "2026-08-11T00:00:00.000Z",
			}),
		).toThrow("Game diagnostic record exceeds its size limit.");
	});

	it.each(["email", "token", "cookie", "save", "storyFlags", "dialogue"])(
		"rejects forbidden free-form field %s",
		(field) => {
			expect(
				gameDiagnosticRecordSchema.safeParse({
					version: 1,
					event: "runtime.error",
					correlationId: "rpg-001122aabbcc",
					occurredAt: "2026-08-11T00:00:00.000Z",
					[field]: "private",
				}).success,
			).toBe(false);
		},
	);
});
