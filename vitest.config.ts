import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@shared": path.resolve(__dirname, "./shared"),
			"@api": path.resolve(__dirname, "./api"),
			"@web": path.resolve(__dirname, "./web/src"),
		},
	},
	test: {
		include: [
			"api/**/*.test.ts",
			"web/**/*.test.ts",
			"shared/**/*.test.ts",
			"scripts/**/*.test.ts",
		],
		coverage: {
			provider: "v8",
			processingConcurrency: 1,
			reporter: ["text", "html"],
			include: ["api/**/*.ts", "shared/**/*.ts"],
			exclude: [
				// Dashboard overlay runtime and shared contracts have focused gates separate from the template baseline.
				"api/modules/dashboard/**",
				"api/routes/dashboard.route.ts",
				"shared/schemas/dashboard/**",
				// Driver adapters and CLI entrypoints are variant-specific and covered by smoke/contract checks.
				"api/db/migrate.ts",
				"api/db/migrate-sqlite.ts",
				"api/db/schema.ts",
				"api/db/index.ts",
				"api/db/sqlite.ts",
				"api/app/server.ts",
				"api/cli/migrate.ts",
				"api/cli/auth-create-admin.ts",
			],
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 80,
				statements: 80,
			},
		},
	},
});
