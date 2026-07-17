import type {
	DashboardDataFrameV2,
	DashboardDataShape,
	DashboardManifestV2,
	PanelManifestV2,
	PanelQueryBindingV2,
	PanelQueryRequestV2,
	PanelQueryResponseV2,
	PublicDashboardManifestV2,
	VariableManifestV2,
	VariableOptionsResponseV2,
} from "../../../../shared/schemas/dashboard.schema";
import type { DashboardAuthContext, ResolvedRange } from "../types";

export type DashboardQueryFrameInputV2 = Omit<
	DashboardDataFrameV2,
	"schemaVersion" | "source"
>;
export type DashboardQueryHandlerResultV2 = {
	frames: DashboardQueryFrameInputV2[];
	state?: unknown;
};
export type DashboardQueryHandlerContextV2 = {
	requestId: string;
	requestTime: Date;
	dashboardId: string;
	panelId: string;
	queryId: string;
	queryRefId: string;
	outputFrameRefs: string[];
	range: PanelQueryRequestV2["range"];
	resolvedRange: ResolvedRange;
	timezone: string;
	filters: Record<string, string[]>;
	maxDataPoints: number;
	maxRows: number;
	intervalMs?: number;
	bucketOriginMs?: number;
	auth: DashboardAuthContext;
	signal: AbortSignal;
};
export type DashboardQueryHandlerV2 = (
	context: DashboardQueryHandlerContextV2,
) => DashboardQueryHandlerResultV2 | Promise<DashboardQueryHandlerResultV2>;

export type DashboardVariableOptionsHandlerContextV2 = {
	requestId: string;
	requestTime: Date;
	dashboardId: string;
	variableId: string;
	resolvedRange: ResolvedRange;
	timezone: string;
	dependsOn: Record<string, string[]>;
	filters: Record<string, string[]>;
	auth: DashboardAuthContext;
	signal: AbortSignal;
};
export type DashboardVariableOptionsHandlerV2 = (
	context: DashboardVariableOptionsHandlerContextV2,
) => unknown | Promise<unknown>;

export type DashboardQueryDefinitionV2 = {
	id: string;
	filterKeys: string[];
	interval?: "none" | "auto";
	outputShapes: DashboardDataShape[];
	handler: DashboardQueryHandlerV2;
};
export type DashboardVariableDefinitionV2 = {
	manifest: VariableManifestV2;
	options?: DashboardVariableOptionsHandlerV2;
};
export type DashboardDefinitionV2 = {
	manifest: DashboardManifestV2;
	variables: DashboardVariableDefinitionV2[];
	queries: DashboardQueryDefinitionV2[];
};
export type NativeDashboardRegistration = {
	sourceVersion: 2;
	native: DashboardDefinitionV2;
};
export type DashboardServiceResult =
	| PublicDashboardManifestV2
	| VariableOptionsResponseV2
	| PanelQueryResponseV2;

export type PanelBindingWithQuery = PanelQueryBindingV2 & {
	query: DashboardQueryDefinitionV2;
};
export type NativePanel = PanelManifestV2 & {
	bindings: PanelBindingWithQuery[];
};
