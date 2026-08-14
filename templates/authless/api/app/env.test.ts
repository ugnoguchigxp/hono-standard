import { describe, expect, it } from "vitest";
import { APP_CONFIG_DEFAULTS } from "../config/appDefaults";
import { readAppEnv } from "./env";

describe("readAppEnv", () => {
	it("uses authless baseline defaults", () => {
		const env = readAppEnv({});
		expect(env.host).toBe(APP_CONFIG_DEFAULTS.host);
		expect(env.databaseUrl).toBe(APP_CONFIG_DEFAULTS.databaseUrl);
		expect(env.corsOrigins).toEqual(APP_CONFIG_DEFAULTS.corsOrigins);
	});

	it("accepts runtime overrides and includes APP_URL in CORS", () => {
		const env = readAppEnv({
			PORT: "5174",
			DATABASE_URL: "tmp/app.sqlite",
			APP_URL: "https://app.example.com",
			CORS_ORIGINS: "https://other.example.com",
			SECURITY_HEADERS_MODE: "https",
		});
		expect(env.port).toBe(5174);
		expect(env.databaseUrl).toBe("tmp/app.sqlite");
		expect(env.corsOrigins).toEqual([
			"https://other.example.com",
			"https://app.example.com",
		]);
		expect(env.securityHeadersMode).toBe("https");
	});

	it("rejects connection URLs in production", () => {
		expect(() =>
			readAppEnv({
				NODE_ENV: "production",
				DATABASE_URL: "postgres://localhost/app",
			}),
		).toThrow(/SQLite database file path/);
	});

	it("falls back from a development connection URL and normalizes blanks", () => {
		const env = readAppEnv({
			DATABASE_URL: "postgres://localhost/app",
			HOST: " ",
			PORT: " ",
			APP_URL: " ",
			SECURITY_HEADERS_MODE: " ",
		});
		expect(env.databaseUrl).toBe(APP_CONFIG_DEFAULTS.databaseUrl);
		expect(env.host).toBe(APP_CONFIG_DEFAULTS.host);
		expect(env.port).toBe(APP_CONFIG_DEFAULTS.port);
		expect(env.securityHeadersMode).toBe("auto");
	});
});
