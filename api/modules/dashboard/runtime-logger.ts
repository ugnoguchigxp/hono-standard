import { z } from "zod";

const identityFields = {
	requestId: z.string().uuid(),
	dashboardId: z.string(),
	panelId: z.string().optional(),
	variableId: z.string().optional(),
	queryId: z.string().optional(),
	queryRefId: z.string().optional(),
};

const eventSchema = z.discriminatedUnion("event", [
	z.object({ event: z.literal("start"), ...identityFields }).strict(),
	z
		.object({
			event: z.literal("success"),
			...identityFields,
			durationMs: z.number().int().min(0),
			frameCount: z.number().int().min(0).optional(),
			fieldCount: z.number().int().min(0).optional(),
			rowCount: z.number().int().min(0).optional(),
			cellCount: z.number().int().min(0).optional(),
		})
		.strict(),
	z
		.object({
			event: z.literal("failure"),
			...identityFields,
			errorCode: z.string(),
		})
		.strict(),
	z
		.object({
			event: z.enum(["late-settlement-fulfilled", "late-settlement-rejected"]),
			...identityFields,
		})
		.strict(),
]);

export type DashboardRuntimeLogEvent = z.infer<typeof eventSchema>;
export type LegacyDashboardRuntimeLogEvent =
	| {
			kind: "start";
			requestId: string;
			dashboardId: string;
			operation: string;
	  }
	| {
			kind: "late-settlement";
			requestId: string;
			dashboardId: string;
			operation: string;
			outcome: "fulfilled" | "rejected";
	  };
export type DashboardStructuredRuntimeLogger = {
	info(event: DashboardRuntimeLogEvent): void;
	warn(event: DashboardRuntimeLogEvent): void;
	error(event: DashboardRuntimeLogEvent, cause?: unknown): void;
	event?: (event: unknown) => void;
};
export type DashboardRuntimeLogger =
	| DashboardStructuredRuntimeLogger
	| {
			event(event: unknown): void;
			info?: (event: DashboardRuntimeLogEvent) => void;
			warn?: (event: DashboardRuntimeLogEvent) => void;
			error?: (event: DashboardRuntimeLogEvent, cause?: unknown) => void;
	  };

export function createNoopDashboardRuntimeLogger(): DashboardStructuredRuntimeLogger {
	return {
		event: () => undefined,
		info: () => undefined,
		warn: () => undefined,
		error: () => undefined,
	};
}

export function safeLog(
	logger: DashboardRuntimeLogger,
	event: DashboardRuntimeLogEvent | LegacyDashboardRuntimeLogEvent,
	cause?: unknown,
) {
	try {
		if ("kind" in event) {
			if (event.kind === "start" || event.kind === "late-settlement")
				logger.event?.(event);
			return;
		}
		const parsed = eventSchema.parse(event);
		if (parsed.event === "failure")
			logger.error ? logger.error(parsed, cause) : logger.event?.(parsed);
		else if (parsed.event.startsWith("late-settlement-"))
			logger.warn ? logger.warn(parsed) : logger.event?.(parsed);
		else logger.info ? logger.info(parsed) : logger.event?.(parsed);
	} catch {
		// Logging must never turn a dashboard request into a failed request.
	}
}
