import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: [
			"api/**/*.test.ts",
			"web/**/*.test.ts",
			"shared/**/*.test.ts",
			"scripts/**/*.test.ts",
		],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			// Unit coverage measures server/shared code and testable Web logic.
			// React composition and presentation components are covered by browser E2E.
			include: ["api/**/*.ts", "shared/**/*.ts", "web/**/*.ts"],
			exclude: [
				// Driver adapters and CLI entrypoints are variant-specific and covered by smoke/contract checks.
				"api/db/migrate.ts",
				"api/db/migrate-sqlite.ts",
				"api/db/schema.ts",
				"api/db/index.ts",
				"api/db/sqlite.ts",
				"api/app/server.ts",
				"api/worker.ts",
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
