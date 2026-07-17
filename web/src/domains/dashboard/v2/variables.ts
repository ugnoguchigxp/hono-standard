import type {
	PublicDashboardManifestV2,
	VariableOptionsResponseV2,
} from "@shared/schemas/dashboard.schema";

export type VariableResolutionState = "blocked" | "loading" | "error" | "ready";

export type VariableOptionState = {
	data?: VariableOptionsResponseV2;
	isPending?: boolean;
	isError?: boolean;
};

const optionState = (
	result: VariableOptionsResponseV2 | VariableOptionState | undefined,
): VariableOptionState =>
	result && "schemaVersion" in result ? { data: result } : (result ?? {});

export function reconcileVariableFilters(
	manifest: PublicDashboardManifestV2,
	results: Array<VariableOptionsResponseV2 | VariableOptionState | undefined>,
	filters: Record<string, string[]>,
) {
	const next: Record<string, string[]> = {};
	const statusByVariable: Record<string, VariableResolutionState> = {};
	manifest.variables.forEach((variable, index) => {
		if (
			variable.dependsOn.some(
				(dependency) => statusByVariable[dependency] !== "ready",
			)
		) {
			statusByVariable[variable.id] = "blocked";
			if (filters[variable.id]?.length)
				next[variable.id] = [...new Set(filters[variable.id])].sort();
			return;
		}
		const result = optionState(results[index]);
		if (result.isError) {
			statusByVariable[variable.id] = "error";
			if (filters[variable.id]?.length)
				next[variable.id] = [...new Set(filters[variable.id])].sort();
			return;
		}
		if (result.isPending || !result.data) {
			statusByVariable[variable.id] = "loading";
			const pending = filters[variable.id] ?? variable.defaultValues;
			if (pending.length) next[variable.id] = [...new Set(pending)].sort();
			return;
		}
		const options = result.data.options;
		const allowed = new Set(
			options
				.filter((option) => !option.disabled)
				.map((option) => option.value),
		);
		const current = (filters[variable.id] ?? []).filter((value) =>
			allowed.has(value),
		);
		const defaults = variable.defaultValues.filter((value) =>
			allowed.has(value),
		);
		const selected =
			variable.selection === "single"
				? current[0]
					? [current[0]]
					: defaults.slice(0, 1)
				: current.length
					? current
					: defaults;
		if (variable.required && selected.length === 0) {
			const firstEnabled = options.find((option) => !option.disabled);
			if (firstEnabled) selected.push(firstEnabled.value);
		}
		if (selected.length) next[variable.id] = [...new Set(selected)].sort();
		statusByVariable[variable.id] = "ready";
	});
	const panelsReady = manifest.variables
		.filter((variable) => variable.required)
		.every(
			(variable) =>
				statusByVariable[variable.id] === "ready" &&
				(next[variable.id]?.length ?? 0) > 0,
		);
	const allReady = manifest.variables.every(
		(variable) => statusByVariable[variable.id] === "ready",
	);
	const normalizedInput = Object.fromEntries(
		Object.entries(filters)
			.filter(([, values]) => values.length > 0)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, values]) => [key, [...new Set(values)].sort()]),
	);
	const normalizedNext = Object.fromEntries(
		Object.entries(next).sort(([left], [right]) => left.localeCompare(right)),
	);
	return {
		filters: normalizedNext,
		statusByVariable,
		panelsReady,
		changed:
			allReady &&
			JSON.stringify(normalizedNext) !== JSON.stringify(normalizedInput),
	};
}
