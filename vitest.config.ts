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
			include: ["api/**/*.ts", "shared/**/*.ts"],
			exclude: [
				// Process entrypoints and generated/ambient declarations have no unit-test surface.
				"api/app/server.ts",
				"api/app/hono.ts",
				"api/cli/**",
				"api/types/**",
				// Infrastructure adapters are exercised by the PostgreSQL-backed E2E suite
				// or provider contract tests. The 80% unit gate covers the application core.
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
