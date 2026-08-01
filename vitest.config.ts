import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			{
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
				// Process entrypoints and generated/ambient declarations have no unit-test surface.
				"api/app/server.ts",
				"api/app/hono.ts",
				"api/cli/**",
				"api/types/**",
				// Infrastructure adapters are exercised by the PostgreSQL-backed E2E suite
				// or provider contract tests. The 95% unit gate covers the application core.
				"api/db/migrate.ts",
				"api/db/schema.ts",
				"api/db/index.ts",
				"api/db/sqlite.ts",
				"api/modules/settings/settings.repository.ts",
				"api/modules/agentic-search/llm/openai-responses-adapter.ts",
				"api/modules/sources/source.repository.ts",
				"api/modules/sources/wiki/blob-sync.ts",
				"api/modules/sources/wiki/content-repo.ts",
				"api/providers/AzureOpenAiProvider.ts",
				"api/providers/BraveSearchProvider.ts",
				"api/providers/ExaSearchProvider.ts",
				// Browser and route composition entrypoints are declarative wiring covered by Playwright smoke tests.
				"web/src/main.tsx",
				"web/src/App.tsx",
				"web/src/router.tsx",
				"web/src/routes/**/*.tsx",
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
