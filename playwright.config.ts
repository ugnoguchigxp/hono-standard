import { defineConfig, devices } from "@playwright/test";

const e2ePort = process.env.E2E_PORT ?? "5174";
const e2eUrl = `http://127.0.0.1:${e2ePort}`;

export function defineDashboardPlaywrightConfig(
	testDir: string,
	options: { inspector?: boolean } = {},
) {
	return defineConfig({
		testDir,
		timeout: 30_000,
		fullyParallel: false,
		forbidOnly: !!process.env.CI,
		retries: 0,
		reporter: [["list"], ["html", { open: "never" }]],
		use: {
			baseURL: e2eUrl,
			locale: "en-US",
			timezoneId: "UTC",
			colorScheme: "light",
			trace: "retain-on-failure",
			screenshot: "only-on-failure",
		},
		projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
		webServer: {
			command: `${options.inspector ? "E2E_INSPECTOR=1 " : ""}bun scripts/e2e-server.ts`,
			url: e2eUrl,
			reuseExistingServer: false,
			timeout: 60_000,
		},
	});
}

export default defineConfig({
	testDir: "tests/e2e",
	timeout: 30_000,
	expect: {
		timeout: 5_000,
	},
	fullyParallel: false,
	retries: 0,
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: e2eUrl,
		trace: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: "E2E_INSPECTOR=1 bun scripts/e2e-server.ts",
		url: e2eUrl,
		reuseExistingServer: false,
		timeout: 60_000,
	},
});
