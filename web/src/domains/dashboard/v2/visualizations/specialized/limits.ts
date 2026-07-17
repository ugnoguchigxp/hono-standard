export const SPECIALIZED_LIMITS = {
	maxNodes: 250,
	maxEdges: 500,
	maxLogs: 2_000,
	maxTraces: 3,
	maxTraceSpans: 2_000,
	maxTraceDepth: 64,
	maxProfileNodes: 2_000,
	maxProfileDepth: 128,
	maxGeoPoints: 800,
	maxGeoClusterInputs: 2_000,
	maxGeoRoutes: 1_000,
	maxGeoRegions: 249,
} as const;

export function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

export function finite(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}
