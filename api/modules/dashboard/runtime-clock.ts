import { z } from "zod";

export type DashboardRuntimeClock = {
	now(): Date;
	monotonicMs(): number;
	requestId(): string;
};

const dashboardRequestIdSchema = z.string().uuid();

export function validateDashboardRequestId(value: unknown): string {
	const parsed = dashboardRequestIdSchema.safeParse(value);
	if (!parsed.success)
		throw new TypeError("request ID factory must return a UUID");
	return parsed.data;
}

export function createSystemDashboardRuntimeClock(
	requestIdFactory: () => string = () => crypto.randomUUID(),
): DashboardRuntimeClock {
	return {
		now: () => new Date(),
		monotonicMs: () => performance.now(),
		requestId: () => validateDashboardRequestId(requestIdFactory()),
	};
}

export type DashboardTestClock = DashboardRuntimeClock & {
	advance(ms: number): void;
	setWallTime(value: Date): void;
};

export function createTestDashboardRuntimeClock(
	options: {
		wallTime?: Date;
		monotonicMs?: number;
		requestIdFactory?: () => string;
	} = {},
): DashboardTestClock {
	let wall = new Date(options.wallTime ?? "2026-01-01T00:00:00.000Z");
	let monotonic = options.monotonicMs ?? 0;
	const factory = options.requestIdFactory ?? (() => crypto.randomUUID());
	return {
		now: () => new Date(wall),
		monotonicMs: () => monotonic,
		requestId: () => validateDashboardRequestId(factory()),
		advance: (ms) => {
			wall = new Date(wall.getTime() + ms);
			monotonic += ms;
		},
		setWallTime: (value) => {
			wall = new Date(value);
		},
	};
}
