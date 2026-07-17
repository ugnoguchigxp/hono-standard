import path from "node:path";
import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

const frontendConfig = mergeConfig(
	baseConfig,
	defineConfig({
		resolve: {
			alias: {
				"@shared": path.resolve(__dirname, "./shared"),
				"@web": path.resolve(__dirname, "./web/src"),
			},
		},
		test: {
			environment: "jsdom",
			setupFiles: ["web/src/domains/dashboard/v2/test/setup.ts"],
			include: [
				"web/src/routes/dashboard-route-search.test.ts",
				"web/src/domains/dashboard/v2/**/*.test.ts",
				"web/src/domains/dashboard/v2/**/*.test.tsx",
			],
			coverage: {
				provider: "v8",
				reportsDirectory:
					process.env.DASHBOARD_FRONTEND_COVERAGE_DIR ??
					"coverage/dashboard-frontend",
				reporter: ["text", "html"],
				include: [
					"web/src/routes/dashboard-route-search.ts",
					"web/src/domains/dashboard/v2/**/*.ts",
					"web/src/domains/dashboard/v2/**/*.tsx",
				],
				exclude: [
					"**/*.test.ts",
					"**/*.test.tsx",
					"**/dashboard-page.tsx",
					"**/gallery/gallery-page.tsx",
					"**/gallery/gallery-route.tsx",
					"**/dashboard-grid.tsx",
					"**/visualizations/specialized-renderer.tsx",
					"**/*.lazy.tsx",
					"**/kpi/family-renderers.tsx",
				],
				thresholds: { statements: 80, lines: 80, functions: 80, branches: 70 },
			},
		},
	}),
);

if (frontendConfig.test) {
	frontendConfig.test.include = [
		"web/src/routes/dashboard-route-search.test.ts",
		"web/src/domains/dashboard/v2/**/*.test.ts",
		"web/src/domains/dashboard/v2/**/*.test.tsx",
	];
	frontendConfig.test.coverage.include = [
		"web/src/routes/dashboard-route-search.ts",
		"web/src/domains/dashboard/v2/**/*.ts",
		"web/src/domains/dashboard/v2/**/*.tsx",
	];
}

export default frontendConfig;
