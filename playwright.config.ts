import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "tests/e2e",
	globalTeardown: "scripts/e2e-global-teardown.ts",
	timeout: 30_000,
	expect: {
		timeout: 5_000,
	},
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: "http://127.0.0.1:5174",
		trace: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
		{ name: "firefox", use: { ...devices["Desktop Firefox"] } },
		{ name: "webkit", use: { ...devices["Desktop Safari"] } },
		{ name: "mobile-chromium", use: { ...devices["Pixel 5"] } },
		{ name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
	],
	webServer: {
		command: "bun scripts/e2e-server.ts",
		url: "http://127.0.0.1:5174",
		reuseExistingServer: false,
		timeout: 60_000,
	},
});
