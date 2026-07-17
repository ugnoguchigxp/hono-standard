import {
	type DashboardDataFrameV2,
	type DashboardNoticeV2,
	dashboardDataFrameV2Schema,
	dashboardNoticeV2Schema,
} from "@shared/schemas/dashboard.schema";
import type { BrowserTransformationInput } from "./transformation-types";

const waitForTransformation = <T>(
	promise: Promise<T>,
	signal?: AbortSignal,
): Promise<T> => {
	if (!signal) return promise;
	if (signal.aborted)
		return Promise.reject(
			new DOMException("The operation was aborted", "AbortError"),
		);
	return new Promise<T>((resolve, reject) => {
		const onAbort = () =>
			reject(new DOMException("The operation was aborted", "AbortError"));
		signal.addEventListener("abort", onAbort, { once: true });
		promise
			.then(resolve, reject)
			.finally(() => signal.removeEventListener("abort", onAbort));
	});
};

export async function executeBrowserTransformations(
	input: BrowserTransformationInput,
): Promise<{
	frames: DashboardDataFrameV2[];
	notices: DashboardNoticeV2[];
	truncated: boolean;
}> {
	const frames = new Map(
		input.responseFrames.map((frame) => [frame.refId, structuredClone(frame)]),
	);
	const notices: DashboardNoticeV2[] = [];
	let truncated = false;
	let cells = 0;
	let operations = 0;
	const maxCells = input.budget?.maxCells ?? 250_000;
	const yieldEvery = Math.max(1, input.budget?.yieldEvery ?? 250);
	const check = () => {
		if (input.signal?.aborted)
			throw new DOMException("The operation was aborted", "AbortError");
		if (cells > maxCells) throw new Error("TRANSFORMATION_CELL_LIMIT");
	};
	for (const spec of input.panel.transformations) {
		if (spec.disabled || spec.execution === "server") continue;
		const definition = input.registry.get(spec.type);
		if (!definition) throw new Error("TRANSFORMATION_NOT_REGISTERED");
		const validation = input.registry.validate(spec);
		if (!validation.valid) throw new Error(validation.error);
		const inputs = spec.inputFrameRefs.map((ref) => frames.get(ref));
		if (inputs.some((frame) => !frame))
			throw new Error("TRANSFORMATION_INPUT_MISSING");
		const execution = Promise.resolve(
			definition.execute(
				{
					panelId: input.panel.id,
					transformationId: spec.id,
					requestId: input.requestId,
					signal: input.signal ?? new AbortController().signal,
					checkBudget: check,
					yieldIfNeeded: async () => {
						await Promise.resolve();
						check();
					},
				},
				inputs as DashboardDataFrameV2[],
				validation.config,
			),
		);
		const result = await waitForTransformation(execution, input.signal);
		check();
		const parsed = dashboardDataFrameV2Schema.parse({
			...result.frame,
			schemaVersion: 2,
			refId: spec.outputFrameRefId,
			source: { kind: "transformation", id: spec.id },
		});
		const resultCells = parsed.fields.reduce(
			(total, field) => total + field.values.length,
			0,
		);
		cells += resultCells;
		check();
		frames.set(parsed.refId, parsed);
		for (const notice of result.notices ?? [])
			if (notices.length < 50)
				notices.push(dashboardNoticeV2Schema.parse(notice));
		truncated ||= result.truncated === true;
		operations += 1;
		if (operations % yieldEvery === 0) await Promise.resolve();
	}
	return { frames: [...frames.values()], notices, truncated };
}
