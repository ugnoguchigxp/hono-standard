import { mergeConfig, defineConfig } from "vitest/config";
import base from "./vitest.config";

const config = mergeConfig(
	base,
	defineConfig({
		test: {
			include: [
				"api/modules/dashboard/**/*.test.ts",
				"api/routes/dashboard.route.test.ts",
				"api/routes/dashboard-version.test.ts",
				"api/app/hono.test.ts",
			],
			coverage: {
				provider: "v8",
				reportsDirectory: "coverage/dashboard",
				reporter: ["text", "html"],
				include: [
					"api/modules/dashboard/**/*.ts",
					"api/routes/dashboard.route.ts",
					"api/routes/dashboard-version.ts",
				],
				exclude: ["api/modules/dashboard/v2/test-fixtures.ts", "**/*.test.ts"],
				thresholds: { statements: 80, lines: 80, functions: 80, branches: 70 },
			},
		},
	}),
);

if (config.test?.coverage) {
	config.test.coverage.include = [
		"api/modules/dashboard/**/*.ts",
		"api/routes/dashboard.route.ts",
		"api/routes/dashboard-version.ts",
	];
	config.test.coverage.exclude = [
		"api/modules/dashboard/v2/test-fixtures.ts",
		"**/*.test.ts",
	];
}

export default config;
