import {
	DASHBOARD_LIMITS,
	DASHBOARD_V2_LIMITS,
} from "../../../shared/schemas/dashboard.schema";

export type DashboardExecutionLimits = {
	maxConcurrent: number;
	queueTimeoutMs: number;
	handlerTimeoutMs: number;
	panelTimeoutMs: number;
	maxQueued: number;
	maxServerTransformations: number;
	serverTransformationBudgetMs: number;
};

export { DASHBOARD_LIMITS };

export const DEFAULT_DASHBOARD_EXECUTION_LIMITS: DashboardExecutionLimits = {
	maxConcurrent: 6,
	queueTimeoutMs: 2_000,
	handlerTimeoutMs: 10_000,
	panelTimeoutMs: 15_000,
	maxQueued: 64,
	maxServerTransformations: 10,
	serverTransformationBudgetMs: 250,
};

export function validateDashboardExecutionLimits(
	limits: DashboardExecutionLimits,
): DashboardExecutionLimits {
	for (const key of [
		"maxConcurrent",
		"queueTimeoutMs",
		"handlerTimeoutMs",
		"panelTimeoutMs",
		"maxServerTransformations",
		"serverTransformationBudgetMs",
	] as const)
		if (!Number.isInteger(limits[key]) || limits[key] <= 0)
			throw new RangeError(`${key} must be a positive integer`);
	if (!Number.isInteger(limits.maxQueued) || limits.maxQueued < 0)
		throw new RangeError("maxQueued must be a non-negative integer");
	if (limits.panelTimeoutMs < limits.handlerTimeoutMs)
		throw new RangeError("panelTimeoutMs must be at least handlerTimeoutMs");
	if (
		limits.maxServerTransformations >
		DASHBOARD_V2_LIMITS.maxTransformationsPerPanel
	)
		throw new RangeError("maxServerTransformations exceeds the shared limit");
	if (limits.serverTransformationBudgetMs >= limits.panelTimeoutMs)
		throw new RangeError(
			"serverTransformationBudgetMs must be less than panelTimeoutMs",
		);
	return limits;
}
