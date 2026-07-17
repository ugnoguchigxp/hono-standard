import type { DashboardApiErrorV2 } from "../api";
export type PanelRuntimeState =
	| "loading"
	| "error"
	| "empty"
	| "partial"
	| "stale"
	| "ready"
	| "incompatible";
export function derivePanelState(input: {
	isPending: boolean;
	error?: Error | null;
	hasData: boolean;
	emptyReason?: string;
	partial?: boolean;
	stale?: boolean;
	incompatible?: boolean;
}): PanelRuntimeState {
	if (input.isPending && !input.hasData) return "loading";
	if (input.error && !input.hasData) return "error";
	if (!input.hasData) return input.emptyReason ? "empty" : "loading";
	if (input.incompatible) return "incompatible";
	if (input.stale) return "stale";
	if (input.partial) return "partial";
	return "ready";
}
export const isRetryableDashboardError = (error: unknown) =>
	error instanceof Error && (error as DashboardApiErrorV2).retryable === true;
