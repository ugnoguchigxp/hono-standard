import { describe, expect, it } from "vitest";
import { APP_CONFIG_DEFAULTS } from "../config/appDefaults";
import { readAppEnv } from "./env";

describe("readAppEnv", () => {
	it("uses minimal app defaults", () => {
		const env = readAppEnv({});
		expect(env.nodeEnv).toBe("development");
		expect(env.host).toBe(APP_CONFIG_DEFAULTS.host);
		expect(env.port).toBe(APP_CONFIG_DEFAULTS.port);
		expect(env.databaseUrl).toBe(APP_CONFIG_DEFAULTS.databaseUrl);
		expect(env.appUrl).toBe(APP_CONFIG_DEFAULTS.appUrl);
		expect(env.corsOrigins).toEqual(APP_CONFIG_DEFAULTS.corsOrigins);
		expect(env.cookieSameSite).toBe(APP_CONFIG_DEFAULTS.cookieSameSite);
		expect(env.loginRateLimitMaxAttempts).toBe(
			APP_CONFIG_DEFAULTS.loginRateLimitMaxAttempts,
		);
	});

	it("accepts database and auth runtime overrides", () => {
		const env = readAppEnv({
			DATABASE_URL: "postgres://example",
			JWT_SECRET: "x".repeat(32),
			APP_URL: "https://showcase.example.com",
			CORS_ORIGINS: "https://showcase.example.com,http://localhost:5173",
			AUTH_COOKIE_SECURE: "true",
			AUTH_COOKIE_SAME_SITE: "none",
			SECURITY_HEADERS_MODE: "https",
			LOGIN_RATE_LIMIT_MAX_ATTEMPTS: "8",
			LOGIN_RATE_LIMIT_WINDOW_SECONDS: "120",
		});

		expect(env.databaseUrl).toBe("postgres://example");
		expect(env.jwtSecret).toBe("x".repeat(32));
		expect(env.appUrl).toBe("https://showcase.example.com");
		expect(env.corsOrigins).toEqual([
			"https://showcase.example.com",
			"http://localhost:5173",
		]);
		expect(env.secureCookie).toBe(true);
		expect(env.cookieSameSite).toBe("none");
		expect(env.securityHeadersMode).toBe("https");
		expect(env.loginRateLimitMaxAttempts).toBe(8);
		expect(env.loginRateLimitWindowSeconds).toBe(120);
	});

	it("rejects SameSite none without secure cookies", () => {
		expect(() =>
			readAppEnv({
				APP_URL: "http://showcase.example.com",
				AUTH_COOKIE_SECURE: "false",
				AUTH_COOKIE_SAME_SITE: "none",
			}),
		).toThrow(/requires secure cookies/);
	});

	it("handles invalid boolean values by letting zod fail validation", () => {
		expect(() =>
			readAppEnv({
				AUTH_COOKIE_SECURE: "invalid-boolean-string",
			}),
		).toThrow();
	});

	it("rejects invalid login rate limit values", () => {
		expect(() => readAppEnv({ LOGIN_RATE_LIMIT_MAX_ATTEMPTS: "0" })).toThrow();
		expect(() =>
			readAppEnv({ LOGIN_RATE_LIMIT_WINDOW_SECONDS: "not-a-number" }),
		).toThrow();
	});

	it("normalizes blank optional values", () => {
		const env = readAppEnv({
			HOST: "   ",
			PORT: "   ",
			APP_URL: "   ",
			AUTH_COOKIE_SECURE: "   ",
			AUTH_COOKIE_SAME_SITE: "   ",
			SECURITY_HEADERS_MODE: "   ",
			JWT_SECRET: "   ",
		});

		expect(env.host).toBe(APP_CONFIG_DEFAULTS.host);
		expect(env.port).toBe(APP_CONFIG_DEFAULTS.port);
		expect(env.appUrl).toBe(APP_CONFIG_DEFAULTS.appUrl);
		expect(env.securityHeadersMode).toBe("auto");
	});

	it("accepts primitive values from programmatic callers", () => {
		const env = readAppEnv({
			PORT: 5175,
			AUTH_COOKIE_SECURE: true,
		} as unknown as NodeJS.ProcessEnv);

		expect(env.port).toBe(5175);
		expect(env.secureCookie).toBe(true);
	});

	it("requires a non-default JWT secret in production", () => {
		expect(() => readAppEnv({ NODE_ENV: "production" })).toThrow(
			/production JWT_SECRET/,
		);
		expect(() =>
			readAppEnv({
				NODE_ENV: "production",
				JWT_SECRET: APP_CONFIG_DEFAULTS.jwtSecret,
			}),
		).toThrow(/production JWT_SECRET/);

		expect(
			readAppEnv({ NODE_ENV: "production", JWT_SECRET: "x".repeat(32) })
				.nodeEnv,
		).toBe("production");
	});

	it("automatically includes APP_URL origin in CORS_ORIGINS", () => {
		const env = readAppEnv({
			APP_URL: "https://my-app.com",
			CORS_ORIGINS: "https://other-origin.com",
		});
		expect(env.corsOrigins).toContain("https://my-app.com");
		expect(env.corsOrigins).toContain("https://other-origin.com");
	});

	it("parses host, port, boolean aliases and optional wiki configuration", () => {
		const env = readAppEnv({
			HOST: " 127.0.0.1 ",
			PORT: "65535",
			AUTH_COOKIE_SECURE: "YES",
			WIKI_STORAGE_BACKEND: " AZURE-BLOB ",
			AZURE_STORAGE_CONNECTION_STRING: " connection ",
			WIKI_BLOB_CONTAINER: " wiki ",
			WIKI_BLOB_PREFIX: " prefix ",
		});

		expect(env).toMatchObject({
			host: "127.0.0.1",
			port: 65535,
			secureCookie: true,
			wikiStorageBackend: "azure-blob",
			azureStorageConnectionString: "connection",
			wikiBlobContainer: "wiki",
			wikiBlobPrefix: "prefix",
		});
		expect(readAppEnv({ AUTH_COOKIE_SECURE: "off" }).secureCookie).toBe(false);
		expect(readAppEnv({ AUTH_COOKIE_SECURE: "1" }).secureCookie).toBe(true);
		expect(readAppEnv({ AUTH_COOKIE_SECURE: "0" }).secureCookie).toBe(false);
		expect(readAppEnv({ PORT: " " }).port).toBe(APP_CONFIG_DEFAULTS.port);
		expect(readAppEnv({ HOST: " " }).host).toBe(APP_CONFIG_DEFAULTS.host);
		expect(() => readAppEnv({ PORT: "70000" })).toThrow();
	});

	it("requires a non-default production JWT secret", () => {
		expect(() => readAppEnv({ NODE_ENV: "production" })).toThrow(
			"Set a production JWT_SECRET",
		);
		const env = readAppEnv({
			NODE_ENV: "production",
			JWT_SECRET: "p".repeat(32),
			APP_URL: "https://app.example.com",
		});
		expect(env.secureCookie).toBe(true);
	});

	it.each([
		["https://api.openai.com", "https://api.openai.com/v1"],
		["https://api.openai.com/", "https://api.openai.com/v1"],
		["https://api.openai.com/v1/", "https://api.openai.com/v1"],
		["https://api.openai.com/custom/", "https://api.openai.com/custom"],
		["https://proxy.example.com/", "https://proxy.example.com"],
		["https://proxy.example.com/v1/", "https://proxy.example.com/v1"],
		[
			"https://resource.openai.azure.com",
			"https://resource.openai.azure.com/openai/v1",
		],
		[
			"https://resource.openai.azure.com/openai",
			"https://resource.openai.azure.com/openai/v1",
		],
		[
			"https://resource.openai.azure.com/openai/v1/",
			"https://resource.openai.azure.com/openai/v1",
		],
		[
			"https://resource.openai.azure.com/openai/deployments/model/chat/completions",
			"https://resource.openai.azure.com/openai/v1",
		],
	])("normalizes OpenAI base URL %s", (input, expected) => {
		const env = readAppEnv({
			OPENAI_API_KEY: "openai-key",
			OPENAI_BASE_URL: input,
		});
		expect(env.openAiCredentialSource).toBe("openai");
		expect(env.openAiBaseUrl).toBe(expected);
	});

	it("normalizes Azure credentials and endpoint precedence", () => {
		const env = readAppEnv({
			AZURE_OPENAI_API_KEY: "azure-key",
			AZURE_OPENAI_ENDPOINT: "https://resource.openai.azure.com/custom/path",
			OPENAI_BASE_URL: "https://fallback.example.com/v1",
			AZURE_OPENAI_DEPLOYMENT: "chat-model",
			AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT: "embedding-model",
		});
		expect(env).toMatchObject({
			openAiCredentialSource: "azure",
			openAiApiKey: "azure-key",
			openAiBaseUrl: "https://resource.openai.azure.com/openai/v1",
			openAiAgenticSearchModel: "chat-model",
			azureOpenAiEmbeddingsDeployment: "embedding-model",
		});
	});

	it("ignores an empty CORS list and preserves an already configured app origin", () => {
		const env = readAppEnv({
			APP_URL: "http://localhost:3000/path",
			CORS_ORIGINS: " , http://localhost:3000, ",
			SECURITY_HEADERS_MODE: " HTTP ",
			AUTH_COOKIE_SAME_SITE: " STRICT ",
		});
		expect(env.corsOrigins).toEqual(["http://localhost:3000"]);
		expect(env.securityHeadersMode).toBe("http");
		expect(env.cookieSameSite).toBe("strict");
	});
});
