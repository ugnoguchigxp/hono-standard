import { z } from "zod";

export const GAME_DIAGNOSTICS_VERSION = 1 as const;
export const GAME_DIAGNOSTIC_MAX_BYTES = 2_048;

const diagnosticEventSchema = z.enum([
	"runtime.start",
	"runtime.stop",
	"runtime.error",
	"session.listener.error",
	"content.load",
	"content.retry",
	"content.error",
	"save.load",
	"save.write",
	"save.timeout",
	"save.offline",
	"save.conflict",
	"save.resolved",
	"save.recovery",
	"battle.catch-up-clamped",
]);

export const gameDiagnosticRecordSchema = z
	.object({
		version: z.literal(GAME_DIAGNOSTICS_VERSION),
		event: diagnosticEventSchema,
		correlationId: z.string().regex(/^rpg-[0-9a-f]{12}$/),
		occurredAt: z.string().datetime(),
		sessionId: z.string().min(1).max(80).optional(),
		sequence: z.number().int().nonnegative().optional(),
		stateRevision: z.number().int().nonnegative().optional(),
		mode: z.enum(["field", "event", "battle"]).optional(),
		mapId: z
			.string()
			.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
			.optional(),
		code: z
			.string()
			.regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/)
			.optional(),
		durationBucketMs: z
			.enum(["lt-50", "50-99", "100-249", "250-999", "gte-1000"])
			.optional(),
		count: z.number().int().nonnegative().max(1_000_000).optional(),
	})
	.strict();

export type GameDiagnosticRecord = z.infer<typeof gameDiagnosticRecordSchema>;
export type GameDiagnosticEvent = GameDiagnosticRecord["event"];

export interface GameDiagnosticsSink {
	record(record: GameDiagnosticRecord): void;
}

export const gameDiagnosticDurationBucket = (
	durationMs: number,
): NonNullable<GameDiagnosticRecord["durationBucketMs"]> => {
	if (durationMs < 50) return "lt-50";
	if (durationMs < 100) return "50-99";
	if (durationMs < 250) return "100-249";
	if (durationMs < 1_000) return "250-999";
	return "gte-1000";
};

export const createGameCorrelationId = (): string =>
	`rpg-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (value) =>
		value.toString(16).padStart(2, "0"),
	).join("")}`;

export function createGameDiagnosticRecord(
	input: Omit<GameDiagnosticRecord, "version" | "occurredAt"> & {
		occurredAt?: string;
	},
): GameDiagnosticRecord {
	const record = gameDiagnosticRecordSchema.parse({
		...input,
		version: GAME_DIAGNOSTICS_VERSION,
		occurredAt: input.occurredAt ?? new Date().toISOString(),
	});
	if (
		new TextEncoder().encode(JSON.stringify(record)).byteLength >
		GAME_DIAGNOSTIC_MAX_BYTES
	) {
		throw new Error("Game diagnostic record exceeds its size limit.");
	}
	return Object.freeze(record);
}
