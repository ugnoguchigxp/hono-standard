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
			thresholds: {
				lines: 95,
				functions: 95,
				branches: 95,
				statements: 95,
			},
		},
	},
});
