import type {
	DashboardManifest,
	DashboardQueryContext,
	PanelData,
	PanelDataState,
	PanelManifest,
	VariableManifest,
	VariableOption,
} from "../../../shared/schemas/dashboard.schema";
import type { AuthContextUser } from "../auth/types";

export type ResolvedRange = {
	from: Date;
	to: Date;
};

export type DashboardAuthContext = Readonly<AuthContextUser>;

export type DashboardHandlerContext = DashboardQueryContext & {
	requestId?: string;
	requestTime?: Date;
	auth?: DashboardAuthContext;
	dashboardId: string;
	panelId: string;
	queryId: string;
	resolvedRange: ResolvedRange;
	intervalMs: number;
	signal: AbortSignal;
	now: () => Date;
};

export type DashboardQueryHandler = (
	context: DashboardHandlerContext,
) => DashboardHandlerResult | Promise<DashboardHandlerResult>;

export type DashboardHandlerResult =
	| PanelData
	| { data: PanelData; state?: PanelDataState };

export type DashboardVariableOptionsContext = {
	requestId?: string;
	requestTime?: Date;
	auth?: DashboardAuthContext;
	dashboardId: string;
	variableId: string;
	range: ResolvedRange;
	timezone: string;
	dependsOn: Record<string, string[]>;
	filters: Record<string, string[]>;
	signal: AbortSignal;
	now: () => Date;
};

export type DashboardVariableOptionsHandler = (
	context: DashboardVariableOptionsContext,
) => VariableOption[] | Promise<VariableOption[]>;

export type DashboardVariableDefinition = {
	manifest: VariableManifest;
	options?: DashboardVariableOptionsHandler;
};

export type DashboardPanelDefinition = {
	manifest: PanelManifest;
	handler: DashboardQueryHandler;
};

export type DashboardDefinition = {
	manifest: DashboardManifest;
	variables: DashboardVariableDefinition[];
	panels: DashboardPanelDefinition[];
};
