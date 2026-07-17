import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard/data-frame.schema";

export type ProgressStepPhase = "completed" | "current" | "pending";

export type ProgressStep = {
	id: string;
	label: string;
	phase: ProgressStepPhase;
};

export type ProgressStepsModel = {
	steps: ProgressStep[];
	currentIndex?: number;
	error?: string;
};

const currentStates = new Set(["current", "active", "in-progress"]);

export function buildProgressSteps(
	frame: DashboardDataFrameV2 | undefined,
	options: {
		currentStepFieldKey?: string;
		completedStateValues?: string[];
	} = {},
): ProgressStepsModel {
	if (!frame) return { steps: [], error: "Progress steps frame is missing" };
	const category = frame.fields.find((field) =>
		field.roles.includes("category"),
	);
	const state = options.currentStepFieldKey
		? frame.fields.find((field) => field.key === options.currentStepFieldKey)
		: frame.fields.find((field) => field.roles.includes("state"));
	if (!category || !state)
		return {
			steps: [],
			error: "Progress steps require category and state fields",
		};
	const labels = category.values.map((value) => String(value ?? ""));
	if (labels.some((label) => !label.trim()))
		return { steps: [], error: "Progress step labels must not be empty" };
	if (new Set(labels).size !== labels.length)
		return { steps: [], error: "Progress step labels must be unique" };
	const completed = new Set(
		(options.completedStateValues ?? ["completed"]).map((value) =>
			value.toLowerCase(),
		),
	);
	const steps = labels.map((label, index): ProgressStep => {
		const rawState = String(state.values[index] ?? "pending").toLowerCase();
		return {
			id: `${frame.refId}:${category.key}:${label}`,
			label,
			phase: completed.has(rawState)
				? "completed"
				: currentStates.has(rawState)
					? "current"
					: "pending",
		};
	});
	const currentIndexes = steps.flatMap((step, index) =>
		step.phase === "current" ? [index] : [],
	);
	if (currentIndexes.length > 1)
		return {
			steps: [],
			error: "Progress steps may have only one current step",
		};
	let reachedOpenStep = false;
	for (const step of steps) {
		if (step.phase !== "completed") reachedOpenStep = true;
		else if (reachedOpenStep)
			return {
				steps: [],
				error:
					"Completed progress steps must precede current and pending steps",
			};
	}
	return {
		steps,
		...(currentIndexes[0] === undefined
			? {}
			: { currentIndex: currentIndexes[0] }),
	};
}

export function progressStepsSummary(
	model: ProgressStepsModel,
	label: string,
): string {
	if (model.error || !model.steps.length) return `${label}: No data`;
	const completed = model.steps.filter(
		(step) => step.phase === "completed",
	).length;
	if (completed === model.steps.length)
		return `${label}: all ${model.steps.length} steps completed`;
	const currentIndex = model.currentIndex ?? completed;
	const current = model.steps[currentIndex];
	return `${label}: step ${currentIndex + 1} of ${model.steps.length}, ${current?.label ?? "Pending"}, ${completed} completed`;
}
