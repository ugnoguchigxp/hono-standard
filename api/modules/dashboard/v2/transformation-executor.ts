import {
	DASHBOARD_V2_LIMITS,
	type DashboardDataFrameV2,
	type DashboardNoticeV2,
	dashboardDataFrameV2Schema,
	dashboardNoticeV2Schema,
	type PanelManifestV2,
	validateDashboardDataFrameShape,
} from "../../../../shared/schemas/dashboard.schema";
import {
	composeAbortSignals,
	getAbortKind,
	raceDashboardOperation,
} from "../abort-signals";
import type { DashboardRuntimeClock } from "../runtime-clock";
import { DashboardRuntimeError } from "../runtime-errors";
import { safeLog, type DashboardRuntimeLogger } from "../runtime-logger";
import type { DashboardTransformationRegistry } from "./transformation-registry";

export async function executeServerTransformations(options: {
	panel: PanelManifestV2;
	initialFrames: DashboardDataFrameV2[];
	registry: DashboardTransformationRegistry;
	requestId: string;
	requestTime: Date;
	dashboardId?: string;
	panelId?: string;
	signal: AbortSignal;
	clock: DashboardRuntimeClock;
	logger?: DashboardRuntimeLogger;
	budgetMs: number;
	maxServerTransformations: number;
}): Promise<{
	frames: DashboardDataFrameV2[];
	notices: DashboardNoticeV2[];
	truncated: boolean;
}> {
	const frameMap = new Map(
		options.initialFrames.map((frame) => [frame.refId, frame]),
	);
	const frames = [...options.initialFrames];
	const notices: DashboardNoticeV2[] = [];
	const started = options.clock.monotonicMs();
	let executed = 0;
	let truncated = false;
	for (const transformation of options.panel.transformations) {
		if (transformation.disabled || transformation.execution !== "server")
			continue;
		if (++executed > options.maxServerTransformations)
			throw new DashboardRuntimeError(
				"TRANSFORMATION_FAILED",
				422,
				"Too many server transformations",
				false,
			);
		if (options.signal.aborted) throw abortError(options.signal);
		const parsed = options.registry.parseSpec(transformation);
		const inputFrames = transformation.inputFrameRefs.map((ref) => {
			const frame = frameMap.get(ref);
			if (!frame)
				throw new DashboardRuntimeError(
					"TRANSFORMATION_FAILED",
					422,
					"Transformation input frame is unavailable",
					false,
				);
			return frame;
		});
		const inputShapes = inputFrames.map((frame) => {
			const shape = validateDashboardDataFrameShape(frame);
			if (!shape.valid)
				throw new DashboardRuntimeError(
					"TRANSFORMATION_FAILED",
					422,
					"Transformation input frame is incompatible",
					false,
				);
			return shape.shape;
		});
		if (
			parsed.descriptor.inputShapes[0] !== "any" &&
			inputShapes.some(
				(shape) => !(parsed.descriptor.inputShapes as string[]).includes(shape),
			)
		)
			throw new DashboardRuntimeError(
				"TRANSFORMATION_FAILED",
				422,
				"Transformation input frame is incompatible",
				false,
			);
		let executionSignal = options.signal;
		const checkBudget = () => {
			if (executionSignal.aborted) throw abortError(executionSignal);
			if (options.clock.monotonicMs() - started > options.budgetMs)
				throw new DashboardRuntimeError(
					"TRANSFORMATION_FAILED",
					504,
					"Dashboard transformation timed out",
					true,
				);
		};
		checkBudget();
		let result:
			| Awaited<ReturnType<NonNullable<typeof parsed.definition.execute>>>
			| undefined;
		const budgetController = new AbortController();
		const remainingBudgetMs = Math.max(
			1,
			options.budgetMs - (options.clock.monotonicMs() - started),
		);
		const budgetTimer = setTimeout(
			() => budgetController.abort({ kind: "transformation-timeout" }),
			remainingBudgetMs,
		);
		const composed = composeAbortSignals([
			options.signal,
			budgetController.signal,
		]);
		executionSignal = composed.signal;
		try {
			const promise = Promise.resolve().then(() =>
				parsed.definition.execute?.(
					{
						requestId: options.requestId,
						requestTime: options.requestTime,
						dashboardId: options.dashboardId,
						panelId: options.panelId,
						inputFrames: inputFrames.map((frame) => structuredClone(frame)),
						signal: executionSignal,
						checkBudget,
						throwIfAborted: () => {
							if (executionSignal.aborted) throw abortError(executionSignal);
						},
					} as never,
					parsed.config as never,
				),
			);
			result = await raceDashboardOperation(promise, {
				signal: executionSignal,
				onLateSettlement: (outcome) => {
					if (!options.logger) return;
					safeLog(options.logger, {
						event: `late-settlement-${outcome}`,
						requestId: options.requestId,
						dashboardId: options.dashboardId ?? "unknown",
						...(options.panelId === undefined
							? {}
							: { panelId: options.panelId }),
					});
				},
			});
		} catch (error) {
			if (getAbortKind(executionSignal) === "transformation-timeout")
				throw new DashboardRuntimeError(
					"TRANSFORMATION_FAILED",
					504,
					"Dashboard transformation timed out",
					true,
					undefined,
					error,
				);
			throw error instanceof DashboardRuntimeError
				? error
				: new DashboardRuntimeError(
						"TRANSFORMATION_FAILED",
						500,
						"Dashboard transformation failed",
						true,
						undefined,
						error,
					);
		} finally {
			clearTimeout(budgetTimer);
			composed.dispose();
		}
		checkBudget();
		if (!result || typeof result !== "object" || !("frame" in result))
			throw new DashboardRuntimeError(
				"TRANSFORMATION_FAILED",
				422,
				"Transformation returned an invalid frame",
				false,
			);
		const frameValue = result.frame as Record<string, unknown>;
		const output = dashboardDataFrameV2Schema.safeParse({
			...frameValue,
			refId: transformation.outputFrameRefId,
			schemaVersion: 2,
			source: { kind: "transformation", id: transformation.id },
		});
		if (!output.success)
			throw new DashboardRuntimeError(
				"TRANSFORMATION_FAILED",
				422,
				"Transformation returned an invalid frame",
				false,
				undefined,
				output.error,
			);
		const shape = validateDashboardDataFrameShape(output.data);
		if (!shape.valid)
			throw new DashboardRuntimeError(
				"TRANSFORMATION_FAILED",
				422,
				"Transformation returned an incompatible frame",
				false,
			);
		const expectedShape =
			parsed.descriptor.outputShape === "preserve"
				? (inputFrames[0]?.meta.shapeHint ?? "table")
				: parsed.descriptor.outputShape;
		if (expectedShape !== "dynamic" && shape.shape !== expectedShape)
			throw new DashboardRuntimeError(
				"TRANSFORMATION_FAILED",
				422,
				"Transformation returned an incompatible frame",
				false,
			);
		frameMap.set(output.data.refId, output.data);
		frames.push(output.data);
		for (const notice of result.notices ?? []) {
			const parsedNotice = dashboardNoticeV2Schema.safeParse(notice);
			if (!parsedNotice.success)
				throw new DashboardRuntimeError(
					"TRANSFORMATION_FAILED",
					422,
					"Transformation returned an invalid notice",
					false,
				);
			if (notices.length >= DASHBOARD_V2_LIMITS.maxNotices)
				throw new DashboardRuntimeError(
					"TRANSFORMATION_FAILED",
					422,
					"Transformation notices exceed the limit",
					false,
				);
			notices.push(parsedNotice.data);
		}
		truncated ||= result.truncated ?? false;
	}
	return { frames, notices, truncated };
}

function abortError(signal: AbortSignal) {
	const kind = getAbortKind(signal);
	if (kind === "panel-timeout")
		return new DashboardRuntimeError(
			"PANEL_TIMEOUT",
			504,
			"Dashboard panel timed out",
			true,
		);
	if (kind === "handler-timeout")
		return new DashboardRuntimeError(
			"HANDLER_TIMEOUT",
			504,
			"Dashboard handler timed out",
			true,
		);
	if (kind === "transformation-timeout")
		return new DashboardRuntimeError(
			"TRANSFORMATION_FAILED",
			504,
			"Dashboard transformation timed out",
			true,
		);
	return new DashboardRuntimeError(
		"REQUEST_CANCELLED",
		408,
		"Dashboard request was cancelled",
		false,
	);
}
