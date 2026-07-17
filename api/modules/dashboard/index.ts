import type { AppEnv } from "../../app/env";
import {
	type DashboardExecutionLimits,
	DEFAULT_DASHBOARD_EXECUTION_LIMITS,
	validateDashboardExecutionLimits,
} from "./dashboard-limits";
import { DashboardRegistry } from "./dashboard-registry";
import {
	createDashboardService,
	type DashboardService,
} from "./dashboard-service";
import { demoDashboards } from "./demo-dashboard";
import { DashboardExecutionLimiter } from "./execution-limiter";
import {
	createSystemDashboardRuntimeClock,
	type DashboardRuntimeClock,
	validateDashboardRequestId,
} from "./runtime-clock";
import {
	createNoopDashboardRuntimeLogger,
	type DashboardRuntimeLogger,
} from "./runtime-logger";
import type { DashboardDefinition } from "./types";
import { DashboardRegistryV2 } from "./v2/dashboard-registry";
import {
	type AnyTransformationRuntimeDefinition,
	DashboardTransformationRegistry,
} from "./v2/transformation-registry";
import type { DashboardDefinitionV2 } from "./v2/types";
import { DashboardVisualizationRegistry } from "./v2/visualization-registry";

export type DashboardModule = {
	registry: DashboardRegistry;
	limiter: DashboardExecutionLimiter;
	now: () => Date;
	limits: DashboardExecutionLimits;
	clock: DashboardRuntimeClock;
	logger: DashboardRuntimeLogger;
	requestIdFactory: () => string;
	v2Registry: DashboardRegistryV2;
	transformations: DashboardTransformationRegistry;
	service: DashboardService;
};

export function createDashboardModule(
	options: {
		dashboards?: DashboardDefinition[];
		limits?: Partial<DashboardExecutionLimits>;
		now?: () => Date;
		clock?: DashboardRuntimeClock;
		logger?: DashboardRuntimeLogger;
		requestIdFactory?: () => string;
		nativeDashboards?: DashboardDefinitionV2[];
		visualizations?: ConstructorParameters<
			typeof DashboardVisualizationRegistry
		>[0];
		// biome-ignore lint/suspicious/noExplicitAny: transformation definitions are intentionally heterogeneous at the module boundary.
		transformations?: AnyTransformationRuntimeDefinition<any>[];
	} = {},
): DashboardModule {
	if (options.clock && options.now)
		throw new TypeError("clock and now cannot be provided together");
	const limits = validateDashboardExecutionLimits({
		...DEFAULT_DASHBOARD_EXECUTION_LIMITS,
		...options.limits,
	});
	const baseClock = options.clock ?? createSystemDashboardRuntimeClock();
	const clock = options.now ? { ...baseClock, now: options.now } : baseClock;
	const rawRequestIdFactory =
		options.requestIdFactory ?? (() => clock.requestId());
	const requestIdFactory = () =>
		validateDashboardRequestId(rawRequestIdFactory());
	const transformations = new DashboardTransformationRegistry(
		options.transformations ?? [],
	);
	const registry = new DashboardRegistry(options.dashboards ?? demoDashboards);
	const v2Registry = new DashboardRegistryV2({
		dashboards: options.nativeDashboards ?? [],
		visualizations: new DashboardVisualizationRegistry(
			options.visualizations ?? [],
		),
		transformations,
	});
	for (const definition of options.nativeDashboards ?? [])
		if (registry.get(definition.manifest.id))
			throw new TypeError(
				`Dashboard ID is registered in both v1 and v2: ${definition.manifest.id}`,
			);
	const module = {
		registry,
		limiter: new DashboardExecutionLimiter({
			maxConcurrent: limits.maxConcurrent,
			queueTimeoutMs: limits.queueTimeoutMs,
			maxQueued: limits.maxQueued,
		}),
		now: clock.now,
		limits,
		clock,
		logger: options.logger ?? createNoopDashboardRuntimeLogger(),
		requestIdFactory,
		v2Registry,
		transformations,
		service: undefined as unknown as DashboardService,
	};
	module.service = createDashboardService({
		module,
		v2: v2Registry,
		transformations,
	});
	return module;
}

export type DashboardAppEnv = Pick<AppEnv, "nodeEnv">;
export type { DashboardExecutionLimits } from "./dashboard-limits";
export {
	DashboardRegistry,
	DashboardRegistryError,
} from "./dashboard-registry";
export type { DashboardService } from "./dashboard-service";
export { defineDashboard } from "./define-dashboard";
export { demoDashboard, demoDashboards } from "./demo-dashboard";
export {
	createDashboardQueryExecutor,
	DashboardQueryError,
} from "./query-executor";
export {
	categoryResult,
	statResult,
	tableResult,
	timeSeriesResult,
} from "./result-builders";
export * from "./runtime-clock";
export * from "./runtime-errors";
export * from "./runtime-logger";
export type * from "./types";
export * from "./v2/adapters";
export { DashboardRegistryV2 } from "./v2/dashboard-registry";
export * from "./v2/define-dashboard";
export * from "./v2/frame-builders";
export {
	GALLERY_DASHBOARD_ID,
	galleryCases,
	galleryDashboardV2,
	galleryVisualizations,
} from "./v2/gallery-dashboard";
export {
	OPERATIONS_DASHBOARD_ID,
	operationsDashboardV2,
} from "./v2/operations-dashboard";
export { DashboardTransformationRegistry } from "./v2/transformation-registry";
export * from "./v2/types";
export { DashboardVisualizationRegistry } from "./v2/visualization-registry";
