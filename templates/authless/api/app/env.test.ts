import { describe, expect, it } from "vitest";
import { APP_CONFIG_DEFAULTS } from "../config/appDefaults";
import { readAppEnv } from "./env";

describe("readAppEnv", () => {
	it("uses authless PostgreSQL defaults", () => {
		const env = readAppEnv({});
		expect(env.host).toBe(APP_CONFIG_DEFAULTS.host);
		expect(env.databaseUrl).toBe(APP_CONFIG_DEFAULTS.databaseUrl);
		expect(env.corsOrigins).toEqual(APP_CONFIG_DEFAULTS.corsOrigins);
	});

	it("accepts runtime overrides and includes APP_URL in CORS", () => {
		const env = readAppEnv({
			PORT: "5174",
			DATABASE_URL: "postgres://postgres:postgres@localhost:5433/custom",
			APP_URL: "https://app.example.com",
			CORS_ORIGINS: "https://other.example.com",
			SECURITY_HEADERS_MODE: "https",
		});
		expect(env.port).toBe(5174);
		expect(env.databaseUrl).toBe(
			"postgres://postgres:postgres@localhost:5433/custom",
		);
		expect(env.corsOrigins).toEqual([
			"https://other.example.com",
			"https://app.example.com",
		]);
		expect(env.securityHeadersMode).toBe("https");
	});

	it("accepts a PostgreSQL connection URL in production", () => {
		const env = readAppEnv({
			NODE_ENV: "production",
			DATABASE_URL: "postgres://postgres:postgres@db:5432/app",
		});
		expect(env.databaseUrl).toBe(
			"postgres://postgres:postgres@db:5432/app",
		);
	});

	it("normalizes blank optional values to defaults", () => {
		const env = readAppEnv({
			HOST: " ",
			PORT: " ",
			APP_URL: " ",
			CORS_ORIGINS: " ",
			SECURITY_HEADERS_MODE: " ",
		});
		expect(env.host).toBe(APP_CONFIG_DEFAULTS.host);
		expect(env.port).toBe(APP_CONFIG_DEFAULTS.port);
		expect(env.appUrl).toBe(APP_CONFIG_DEFAULTS.appUrl);
		expect(env.corsOrigins).toEqual(APP_CONFIG_DEFAULTS.corsOrigins);
		expect(env.securityHeadersMode).toBe("auto");
	});
});
