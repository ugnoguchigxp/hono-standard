import type {
	DashboardDataFrameV2,
	DashboardNoticeV2,
	PanelManifestV2,
	VisualizationDefinition,
	VisualizationSpecV2,
	AnnotationLayerSpecV1,
} from "@shared/schemas/dashboard.schema";
import type { ComponentType } from "react";

export type DashboardPanelInteraction = {
	hiddenFieldKeys: ReadonlySet<string>;
	isolatedFieldKey?: string;
	toggleField: (fieldKey: string) => void;
	isolateField: (fieldKey: string) => void;
	resetFields: () => void;
	onDatumActivate: (fieldValues: Record<string, unknown>) => void;
};
export type DashboardVisualizationTheme = {
	mode: "light" | "dark";
	palette: string[];
};
export type DashboardRendererContext<TConfig> = {
	dashboardId: string;
	panel: PanelManifestV2;
	frames: DashboardDataFrameV2[];
	annotationLayers?: ResolvedAnnotationLayer[];
	preset: string;
	config: TConfig;
	timezone: string;
	locale: string;
	theme: DashboardVisualizationTheme;
	interaction: DashboardPanelInteraction;
	resolvedRange?: { from: number; to: number };
	intervalMs?: number;
};
export type ResolvedAnnotationLayer = {
	spec: AnnotationLayerSpecV1;
	frame: DashboardDataFrameV2;
};
export type DashboardRendererModule<TConfig> = {
	Renderer: ComponentType<DashboardRendererContext<TConfig>>;
	buildAccessibleSummary: (
		context: DashboardRendererContext<TConfig>,
	) => string;
};
export type FrontendVisualizationDefinition<TConfig> =
	VisualizationDefinition<TConfig> & {
		loadPolicy: "immediate" | "viewport";
		validateFrames?: (
			frames: DashboardDataFrameV2[],
			config: TConfig,
			preset: string,
		) => string | undefined;
		validateResolvedFrames?: (
			frames: DashboardDataFrameV2[],
			config: TConfig,
			preset: string,
			spec: VisualizationSpecV2,
		) => string | undefined;
		load: () => Promise<DashboardRendererModule<TConfig>>;
	};
export type AnyFrontendVisualizationDefinition =
	// biome-ignore lint/suspicious/noExplicitAny: the heterogeneous plugin registry intentionally erases each config generic at this boundary.
	FrontendVisualizationDefinition<any>;
export type VisualizationResolution =
	| {
			status: "ready";
			definition: AnyFrontendVisualizationDefinition;
			preset: string;
			config: unknown;
			frames: DashboardDataFrameV2[];
			annotationLayers: ResolvedAnnotationLayer[];
			annotationNotices: DashboardNoticeV2[];
	  }
	| {
			status:
				| "unknown-type"
				| "invalid-config"
				| "missing-frame"
				| "incompatible-shape";
			message: string;
			frames: DashboardDataFrameV2[];
			annotationLayers: ResolvedAnnotationLayer[];
			annotationNotices: DashboardNoticeV2[];
	  };

export function defineFrontendVisualization<TConfig>(
	definition: FrontendVisualizationDefinition<TConfig>,
): FrontendVisualizationDefinition<TConfig> {
	return definition;
}

export type { VisualizationSpecV2 };
