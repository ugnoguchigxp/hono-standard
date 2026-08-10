import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@shared": path.resolve(__dirname, "./shared"),
		},
	},
	test: {
		projects: [
			{
				resolve: {
					alias: {
						"@shared": path.resolve(__dirname, "./shared"),
					},
				},
				test: {
					name: "node",
					environment: "node",
					include: [
						"api/**/*.test.ts",
						"web/**/*.test.ts",
						"shared/**/*.test.ts",
						"scripts/**/*.test.ts",
					],
				},
			},
			{
				resolve: {
					alias: {
						"@shared": path.resolve(__dirname, "./shared"),
					},
				},
				test: {
					name: "web",
					environment: "jsdom",
					include: ["web/**/*.test.tsx"],
					setupFiles: ["web/test/setup.ts"],
				},
			},
		],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			include: ["api/**/*.ts", "shared/**/*.ts", "web/src/**/*.{ts,tsx}"],
			exclude: [
				// Driver adapters and CLI entrypoints are variant-specific and covered by smoke/contract checks.
				"api/db/migrate.ts",
				"api/db/migrate-sqlite.ts",
				"api/db/schema.ts",
				"api/db/index.ts",
				"api/db/sqlite.ts",
				"api/app/server.ts",
				"api/cli/migrate.ts",
				"api/cli/auth-create-admin.ts",
				// Browser and route composition entrypoints are declarative wiring covered by Playwright smoke tests.
				"web/src/main.tsx",
				"web/src/App.tsx",
				"web/src/router.tsx",
				"web/src/routes/**/*.tsx",
				// Phaser runtime adapters require a real canvas and are covered by Playwright smoke tests.
				// Field and battle rules remain in shared/game and stay inside unit coverage.
				"web/src/game/PhaserGame.ts",
				"web/src/game/PhaserGameLoader.ts",
				"web/src/game/config.ts",
				"web/src/game/art/**/*.ts",
				"web/src/game/input/**/*.ts",
				"web/src/game/scenes/**/*.ts",
			],
			thresholds: {
				lines: 95,
				functions: 95,
				branches: 95,
				statements: 95,
			},
		},
	},
});
