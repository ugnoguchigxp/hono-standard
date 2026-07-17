import {
	DASHBOARD_V2_LIMITS,
	type DashboardDataFrameV2,
	type DashboardNoticeV2,
	type VisualizationSpecV2,
	validateDashboardDataFrameShape,
	validateVisualizationDefinition,
	visualizationDescriptorSchema,
} from "@shared/schemas/dashboard.schema";
import type {
	AnyFrontendVisualizationDefinition,
	DashboardRendererModule,
	AnyFrontendVisualizationDefinition as Definition,
	VisualizationResolution,
} from "./visualization-types";

export class FrontendVisualizationRegistry {
	private readonly definitions: Map<string, AnyFrontendVisualizationDefinition>;
	private readonly failedLoads = new Set<string>();
	private readonly loadPromises = new Map<
		string,
		Promise<DashboardRendererModule<unknown>>
	>();
	constructor(definitions: AnyFrontendVisualizationDefinition[]) {
		this.definitions = new Map();
		for (const definition of definitions) {
			const descriptor = visualizationDescriptorSchema.parse(
				definition.descriptor,
			);
			if (this.definitions.has(descriptor.type))
				throw new Error(`duplicate visualization type: ${descriptor.type}`);
			if (typeof definition.load !== "function")
				throw new Error(`visualization loader missing: ${descriptor.type}`);
			const presetIds = descriptor.presets.map((preset) => preset.id);
			if (new Set(presetIds).size !== presetIds.length)
				throw new Error(`duplicate visualization preset: ${descriptor.type}`);
			for (const key of Object.keys(definition.defaultOptionsByPreset))
				if (!presetIds.includes(key))
					throw new Error(`unknown visualization preset: ${key}`);
			for (const key of presetIds)
				if (!definition.defaultOptionsByPreset[key])
					throw new Error(`missing visualization preset: ${key}`);
			this.definitions.set(descriptor.type, definition);
		}
	}
	get(type: string) {
		return this.definitions.get(type);
	}
	getTypes() {
		return [...this.definitions.keys()];
	}
	resolve(input: {
		spec: VisualizationSpecV2;
		frames: DashboardDataFrameV2[];
	}): VisualizationResolution {
		const annotationLayers = input.spec.annotationLayers ?? [];
		const emptyAnnotations = { annotationLayers: [], annotationNotices: [] };
		const definition = this.definitions.get(input.spec.type);
		if (!definition)
			return {
				status: "unknown-type",
				message: `Visualization ${input.spec.type} is not available`,
				frames: input.frames,
				...emptyAnnotations,
			};
		const result = validateVisualizationDefinition(input.spec, definition);
		if (!result.valid)
			return {
				status: "invalid-config",
				message: "Visualization configuration is invalid",
				frames: input.frames,
				...emptyAnnotations,
			};
		const frames = input.spec.frameRefs.map((ref) =>
			input.frames.find((frame) => frame.refId === ref),
		);
		if (frames.some((frame) => !frame))
			return {
				status: "missing-frame",
				message: "Visualization data frame is missing",
				frames: frames.filter(
					(frame): frame is DashboardDataFrameV2 => !!frame,
				),
				...emptyAnnotations,
			};
		const selected = frames as DashboardDataFrameV2[];
		const selectedShapeResults = selected.map(validateDashboardDataFrameShape);
		const invalidSelectedShape = selectedShapeResults.find(
			(result) =>
				!result.valid ||
				!definition.descriptor.supportedShapes.includes(result.shape),
		);
		if (invalidSelectedShape)
			return {
				status: "incompatible-shape",
				message: invalidSelectedShape.valid
					? "Visualization does not support this data shape"
					: (invalidSelectedShape.issues[0]?.message ??
						"Visualization data shape is invalid"),
				frames: selected,
				...emptyAnnotations,
			};
		const preset = input.spec.preset ?? definition.descriptor.defaultPreset;
		const incompatibility =
			definition.validateFrames?.(selected, result.config, preset) ??
			definition.validateResolvedFrames?.(
				selected,
				result.config,
				preset,
				input.spec,
			);
		if (incompatibility)
			return {
				status: "incompatible-shape",
				message: incompatibility,
				frames: selected,
				...emptyAnnotations,
			};
		const enabledAnnotationLayers = annotationLayers.filter(
			(layer) => layer.enabled,
		);
		const annotationNotices: DashboardNoticeV2[] = [];
		const resolvedAnnotationLayers = enabledAnnotationLayers.flatMap((spec) => {
			const frame = input.frames.find((item) => item.refId === spec.frameRef);
			const validation = frame
				? validateDashboardDataFrameShape(frame)
				: undefined;
			const hasEventTime = frame?.fields.some((field) =>
				field.roles.includes("time"),
			);
			const modeMatches =
				spec.mode === "region" ? !hasEventTime : hasEventTime === true;
			if (
				!frame ||
				!validation?.valid ||
				validation.shape !== "annotation" ||
				!modeMatches
			) {
				annotationNotices.push({
					severity: "warning",
					code: "ANNOTATION_FRAME_INVALID",
					message: `Annotation layer ${spec.name} is unavailable or incompatible`,
					frameRefId: spec.frameRef,
				});
				return [];
			}
			return [{ spec, frame }];
		});
		const annotationRows = resolvedAnnotationLayers.reduce(
			(total, layer) => total + (layer.frame.fields[0]?.values.length ?? 0),
			0,
		);
		if (annotationRows > DASHBOARD_V2_LIMITS.maxAnnotations)
			return {
				status: "incompatible-shape",
				message: "Annotation data limit exceeded",
				frames: selected,
				annotationLayers: [],
				annotationNotices: [
					...annotationNotices,
					{
						severity: "warning",
						code: "ANNOTATION_LIMIT",
						message: "Annotation data limit exceeded",
					},
				],
			};
		if (
			enabledAnnotationLayers.length > 0 &&
			!definition.descriptor.capabilities.annotations
		)
			return {
				status: "incompatible-shape",
				message: "Visualization does not support annotation layers",
				frames: selected,
				annotationLayers: [],
				annotationNotices,
			};
		return {
			status: "ready",
			definition,
			preset,
			config: result.config,
			frames: selected,
			annotationLayers: resolvedAnnotationLayers,
			annotationNotices,
		};
	}
	load(type: string) {
		const definition = this.definitions.get(type);
		if (!definition)
			return Promise.reject(new Error(`unknown visualization: ${type}`));
		const existing = this.loadPromises.get(type);
		if (existing) return existing;
		const promise = definition
			.load()
			.then((module) => {
				if (
					typeof module.Renderer !== "function" ||
					typeof module.buildAccessibleSummary !== "function"
				)
					throw new Error(`invalid visualization module: ${type}`);
				this.failedLoads.delete(type);
				return module;
			})
			.catch((error) => {
				this.failedLoads.add(type);
				this.loadPromises.delete(type);
				throw error;
			});
		this.loadPromises.set(type, promise);
		return promise;
	}
	clearFailedLoad(type: string) {
		this.failedLoads.delete(type);
		this.loadPromises.delete(type);
	}
	hasFailedLoad(type: string) {
		return this.failedLoads.has(type);
	}
}

export const createFrontendVisualizationRegistry = (
	definitions: Definition[],
) => new FrontendVisualizationRegistry(definitions);
