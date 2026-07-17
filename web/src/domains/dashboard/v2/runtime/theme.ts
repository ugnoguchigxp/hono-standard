import type { DashboardVisualizationTheme } from "./visualization-types";
export const dashboardThemeTokens = [
	"--color-brand",
	"--color-cyan",
	"--color-violet",
	"--color-amber",
	"--color-rose",
] as const;
const knownDashboardColorTokens = new Set<string>([
	...dashboardThemeTokens,
	"--color-muted",
	"--color-muted-strong",
	"--color-danger",
	"--color-chart-primary",
	"--color-chart-primary-strong",
	"--color-chart-danger",
	"--color-chart-warning",
	"--color-chart-success",
	"--color-chart-muted",
]);
export function createDashboardTheme(
	mode: "light" | "dark" = "dark",
): DashboardVisualizationTheme {
	return { mode, palette: [...dashboardThemeTokens] };
}
export function resolveThemeColor(
	token: string | undefined,
	fallback = "--color-brand",
) {
	return `var(${token && knownDashboardColorTokens.has(token) ? token : fallback})`;
}
