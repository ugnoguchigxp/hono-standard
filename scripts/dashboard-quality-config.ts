export const dashboardQualityConfig = {
	schemaVersion: 1,
	dashboardIds: {
		demo: "operations",
		gallery: "visualization-gallery",
	},
	routes: {
		demo: "/dashboard",
		gallery: "/dashboard/gallery",
	},
	viewports: {
		desktop: { width: 1440, height: 1100 },
		tablet: { width: 834, height: 1112 },
		mobile: { width: 390, height: 844 },
	},
	visual: {
		maxDiffPixelRatio: 0.005,
		threshold: 0.15,
	},
	limits: {
		panelReadyMs: 5_000,
		transformMs: 100,
		longTaskMs: 100,
	},
	bundle: {
		initialRawBytes: 900_000,
		initialGzipBytes: 260_000,
		dashboardShellRawBytes: 180_000,
		dashboardShellGzipBytes: 60_000,
	},
} as const;

export type DashboardViewport = keyof typeof dashboardQualityConfig.viewports;

export function assertDashboardQualityConfig() {
	const values = Object.values(dashboardQualityConfig.viewports);
	if (new Set(Object.keys(dashboardQualityConfig.dashboardIds)).size !== 2)
		throw new Error("dashboard IDs must be unique");
	if (values.some(({ width, height }) => width <= 0 || height <= 0))
		throw new Error("dashboard viewports must be positive");
	if (
		dashboardQualityConfig.visual.maxDiffPixelRatio <= 0 ||
		dashboardQualityConfig.visual.maxDiffPixelRatio >= 1
	)
		throw new Error("visual diff ratio must be between zero and one");
}

assertDashboardQualityConfig();
