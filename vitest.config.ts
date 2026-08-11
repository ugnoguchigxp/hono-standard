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
				"web/src/game/GameLauncher.tsx",
				"web/src/game/display.ts",
				"web/src/game/ui/**/*.ts",
				"api/routes/game-save.route.ts",
				"api/modules/game-save/game-content-registry.ts",
				// HTTP/storage synchronization adapters are covered by contract tests and Playwright.
				// Their retry/abort branches depend on browser and network scheduling; the codecs and
				// compatibility rules they call remain in unit coverage.
				"web/src/game/save/ServerGameSaveRepository.ts",
				"web/src/action3d/save/ServerAction3dSaveRepository.ts",
				"web/src/action3d/content/Action3dContentLoader.ts",
				// Phaser runtime adapters require a real canvas and are covered by Playwright smoke tests.
				// Field and battle rules remain in shared/game and stay inside unit coverage.
				"web/src/game/PhaserGame.ts",
				"web/src/game/PhaserGameLoader.ts",
				"web/src/game/config.ts",
				"web/src/game/art/**/*.ts",
				"web/src/game/input/**/*.ts",
				"web/src/game/scenes/**/*.ts",
				// Babylon/WebGL runtime adapters need a real GPU canvas and are covered by Playwright.
				// Action rules remain in shared/action3d and stay inside unit coverage.
				"web/src/action3d/runtime/**/*.ts",
				"web/src/action3d/runtime/**/*.tsx",
				"web/src/action3d/Action3dLauncher.tsx",
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
