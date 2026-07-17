import type {
	DashboardDataFrameV2,
	DashboardNoticeV2,
	PanelManifestV2,
	TransformationDefinition,
} from "@shared/schemas/dashboard.schema";
export type BrowserTransformationContext = {
	panelId: string;
	transformationId: string;
	requestId: string;
	signal: AbortSignal;
	checkBudget: () => void;
	yieldIfNeeded: () => Promise<void>;
};
export type BrowserTransformationResult = {
	frame: Omit<DashboardDataFrameV2, "schemaVersion" | "source" | "refId"> & {
		refId?: string;
		source?: DashboardDataFrameV2["source"];
	};
	notices?: DashboardNoticeV2[];
	truncated?: boolean;
};
export type FrontendTransformationDefinition<TConfig> =
	TransformationDefinition<TConfig> & {
		execute: (
			context: BrowserTransformationContext,
			frames: DashboardDataFrameV2[],
			config: TConfig,
		) => BrowserTransformationResult | Promise<BrowserTransformationResult>;
	};
export type AnyFrontendTransformationDefinition =
	FrontendTransformationDefinition<unknown>;
export type BrowserTransformationInput = {
	panel: PanelManifestV2;
	responseFrames: DashboardDataFrameV2[];
	requestId: string;
	registry: FrontendTransformationRegistry;
	signal?: AbortSignal;
	budget?: { maxCells?: number; yieldEvery?: number };
};
import type { FrontendTransformationRegistry } from "./transformation-registry";
