import {
	transformationDescriptorSchema,
	validateTransformationDefinition,
} from "@shared/schemas/dashboard.schema";
import type { AnyFrontendTransformationDefinition } from "./transformation-types";
export class FrontendTransformationRegistry {
	private readonly definitions = new Map<
		string,
		AnyFrontendTransformationDefinition
	>();
	constructor(definitions: AnyFrontendTransformationDefinition[]) {
		for (const definition of definitions) {
			const descriptor = transformationDescriptorSchema.parse(
				definition.descriptor,
			);
			if (!descriptor.browserCapable)
				throw new Error(
					`browser transformation is not supported: ${descriptor.type}`,
				);
			if (this.definitions.has(descriptor.type))
				throw new Error(`duplicate transformation type: ${descriptor.type}`);
			this.definitions.set(descriptor.type, definition);
		}
	}
	get(type: string) {
		return this.definitions.get(type);
	}
	validate(spec: Parameters<typeof validateTransformationDefinition>[0]) {
		const definition = this.definitions.get(spec.type);
		if (!definition)
			return { valid: false as const, error: "TRANSFORMATION_NOT_REGISTERED" };
		return validateTransformationDefinition(spec, definition);
	}
}
