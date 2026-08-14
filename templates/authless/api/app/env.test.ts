import { describe, expect, it } from "vitest";
import { APP_CONFIG_DEFAULTS } from "../config/appDefaults";
import { readAppEnv } from "./env";

describe("readAppEnv", () => {
	it("uses authless Cloudflare fallback defaults", () => {
		const env = readAppEnv({});
		expect(env.databaseUrl).toBe(APP_CONFIG_DEFAULTS.databaseUrl);
		expect(env.databaseAuthToken).toBeUndefined();
	});

	it("accepts libSQL fallback overrides and includes APP_URL in CORS", () => {
		const env = readAppEnv({
			PORT: "5174",
			DATABASE_URL: "libsql://example.turso.io",
			DATABASE_AUTH_TOKEN: "token",
			APP_URL: "https://app.example.com",
			CORS_ORIGINS: "https://other.example.com",
			SECURITY_HEADERS_MODE: "https",
		});
		expect(env.port).toBe(5174);
		expect(env.databaseUrl).toBe("libsql://example.turso.io");
		expect(env.databaseAuthToken).toBe("token");
		expect(env.corsOrigins).toEqual([
			"https://other.example.com",
			"https://app.example.com",
		]);
		expect(env.securityHeadersMode).toBe("https");
	});

	it("accepts a local file URL in production", () => {
		const env = readAppEnv({
			NODE_ENV: "production",
			DATABASE_URL: "file:/data/turso.db",
		});
		expect(env.databaseUrl).toBe("file:/data/turso.db");
	});

	it("normalizes blank optional values to defaults", () => {
		const env = readAppEnv({
			HOST: " ",
			PORT: " ",
			DATABASE_URL: " ",
			DATABASE_AUTH_TOKEN: " ",
			APP_URL: " ",
			CORS_ORIGINS: " ",
			SECURITY_HEADERS_MODE: " ",
		});
		expect(env.host).toBe(APP_CONFIG_DEFAULTS.host);
		expect(env.port).toBe(APP_CONFIG_DEFAULTS.port);
		expect(env.databaseUrl).toBe(APP_CONFIG_DEFAULTS.databaseUrl);
		expect(env.databaseAuthToken).toBeUndefined();
		expect(env.securityHeadersMode).toBe("auto");
	});
});
