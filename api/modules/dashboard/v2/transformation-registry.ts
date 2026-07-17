import {
	DASHBOARD_V2_LIMITS,
	type DashboardDataFrameV2,
	type DashboardDataShape,
	type TransformationDefinition,
	type TransformationDescriptor,
	type TransformationSpecV2,
	transformationDescriptorSchema,
	transformationSpecV2Schema,
	validateDashboardJsonValue,
} from "../../../../shared/schemas/dashboard.schema";
import { DashboardRuntimeError } from "../runtime-errors";

export type DashboardServerTransformationContext = {
	requestId: string;
	requestTime: Date;
	dashboardId?: string;
	panelId?: string;
	inputFrames: DashboardDataFrameV2[];
	signal: AbortSignal;
	checkBudget(): void;
	throwIfAborted(): void;
};
export type DashboardServerTransformationResult = {
	frame:
		| Omit<DashboardDataFrameV2, "schemaVersion" | "source">
		| DashboardDataFrameV2;
	notices?: Array<{
		severity: "info" | "warning";
		code: string;
		message: string;
		frameRefId?: string;
		fieldKey?: string;
	}>;
	truncated?: boolean;
};
export type AnyTransformationRuntimeDefinition<T = unknown> =
	TransformationDefinition<T> & {
		execute?: (
			context: DashboardServerTransformationContext,
			config: T,
		) =>
			| DashboardServerTransformationResult
			| Promise<DashboardServerTransformationResult>;
	};
export type ParsedTransformationSpec<T = unknown> = {
	descriptor: TransformationDescriptor;
	definition: AnyTransformationRuntimeDefinition<T>;
	config: T;
};

export class DashboardTransformationRegistry {
	private readonly definitions = new Map<
		string,
		AnyTransformationRuntimeDefinition<unknown>
	>();
	constructor(
		// biome-ignore lint/suspicious/noExplicitAny: the heterogeneous registry validates each erased config before execution.
		definitions: Array<AnyTransformationRuntimeDefinition<any>>,
	) {
		for (const definition of definitions) {
			const descriptor = transformationDescriptorSchema.parse(
				definition.descriptor,
			);
			if (this.definitions.has(descriptor.type))
				throw new Error(`Duplicate transformation type: ${descriptor.type}`);
			if (descriptor.serverCapable && !definition.execute)
				throw new Error("server transformation requires execute");
			if (!descriptor.serverCapable && definition.execute)
				throw new Error("browser-only transformation must not execute");
			this.definitions.set(descriptor.type, definition);
		}
	}
	get(type: string) {
		return this.definitions.get(type);
	}
	parseSpec(spec: TransformationSpecV2): ParsedTransformationSpec {
		const parsed = transformationSpecV2Schema.parse(spec);
		const definition = this.definitions.get(parsed.type);
		if (!definition)
			throw new DashboardRuntimeError(
				"TRANSFORMATION_NOT_REGISTERED",
				422,
				"Transformation is not registered",
				false,
			);
		const descriptor = transformationDescriptorSchema.parse(
			definition.descriptor,
		);
		if (parsed.execution === "server" && !descriptor.serverCapable)
			throw new DashboardRuntimeError(
				"TRANSFORMATION_CONFIG_INVALID",
				422,
				"Transformation cannot run on the server",
				false,
			);
		if (parsed.execution === "browser" && !descriptor.browserCapable)
			throw new DashboardRuntimeError(
				"TRANSFORMATION_CONFIG_INVALID",
				422,
				"Transformation cannot run in the browser",
				false,
			);
		try {
			const limits = {
				maxDepth: DASHBOARD_V2_LIMITS.maxJsonDepth,
				maxObjectKeys: DASHBOARD_V2_LIMITS.maxJsonObjectKeys,
				maxArrayItems: DASHBOARD_V2_LIMITS.maxJsonArrayItems,
				maxBytes: DASHBOARD_V2_LIMITS.maxTransformationOptionsBytes,
			};
			const budget = validateDashboardJsonValue(parsed.options, limits);
			if (!budget.valid) throw new Error("budget");
			const config = definition.configSchema.parse(parsed.options);
			if (!validateDashboardJsonValue(config, limits).valid)
				throw new Error("parsed configuration exceeds JSON budget");
			return {
				descriptor,
				definition,
				config,
			};
		} catch (error) {
			throw new DashboardRuntimeError(
				"TRANSFORMATION_CONFIG_INVALID",
				422,
				"Transformation configuration is invalid",
				false,
				undefined,
				error,
			);
		}
	}
	validateShape(
		descriptor: TransformationDescriptor,
		inputShapes: DashboardDataShape[],
		outputShape: DashboardDataShape,
	) {
		const accepts =
			descriptor.inputShapes[0] === "any" ||
			inputShapes.every((shape) =>
				(descriptor.inputShapes as string[]).includes(shape),
			);
		if (!accepts)
			throw new DashboardRuntimeError(
				"TRANSFORMATION_CONFIG_INVALID",
				422,
				"Transformation input shape is incompatible",
				false,
			);
		if (
			descriptor.outputShape !== "dynamic" &&
			descriptor.outputShape !== "preserve" &&
			descriptor.outputShape !== outputShape
		)
			throw new DashboardRuntimeError(
				"TRANSFORMATION_CONFIG_INVALID",
				422,
				"Transformation output shape is incompatible",
				false,
			);
	}
}
