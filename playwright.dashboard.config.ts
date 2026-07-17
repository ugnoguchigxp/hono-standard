import { defineDashboardPlaywrightConfig } from "./playwright.config";

export default defineDashboardPlaywrightConfig("tests/e2e/dashboard", {
	inspector: true,
});
