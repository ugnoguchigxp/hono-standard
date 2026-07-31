import promptArtifact from "../../prompts/generated/catalog.json" with {
	type: "json",
};
import {
	createAppCatalog,
	type PromptKey,
	type PromptValueMap,
} from "../../prompts/generated/catalog.generated";

export const instructionLocales = ["ja-JP", "en-US"] as const;
export type InstructionLocale = (typeof instructionLocales)[number];

export function normalizeInstructionLocale(value: unknown): InstructionLocale {
	return value === "en-US" ? "en-US" : "ja-JP";
}

const promptCatalog = createAppCatalog(promptArtifact as unknown);

export function renderPrompt<K extends PromptKey>(
	instructionLocale: InstructionLocale,
	key: K,
	values: PromptValueMap[K],
) {
	const render = promptCatalog.bind({
		instructionLocale,
		fallbackLocales: [instructionLocale === "ja-JP" ? "en-US" : "ja-JP"],
		trailingNewline: false,
	});
	return render(key, values);
}
