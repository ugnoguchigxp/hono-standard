import {
	normalizeInstructionLocale,
	renderPrompt,
	type InstructionLocale,
} from "../../prompts/catalog";

export function buildAgenticSystemContext(params: {
	userSystemContext: string;
	category?: string;
	topK: number;
	instructionLocale?: InstructionLocale | string;
}): string {
	const invocation = renderPrompt(
		normalizeInstructionLocale(params.instructionLocale),
		"agentic.search-instructions",
		{
			searchSettings: `topK=${params.topK}\ncategory=${params.category ?? "all"}`,
			userSystemContext: params.userSystemContext.trim(),
		},
	);
	return invocation.content.text;
}
