import { z } from "zod";
import { APP_CONFIG_DEFAULTS } from "../config/appDefaults";
import { isDatabaseConnectionUrl } from "../db/path";

const optionalTrimmedString = z.preprocess((value) => {
	if (typeof value !== "string") return value;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}, z.string().trim().optional());

const optionalUrl = z.preprocess((value) => {
	if (typeof value !== "string") return value;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}, z.string().url().optional());

const optionalPort = z.preprocess((value) => {
	if (typeof value === "number") return value;
	if (typeof value !== "string") return value;
	const trimmed = value.trim();
	return trimmed.length > 0 ? Number(trimmed) : undefined;
}, z.number().int().min(1).max(65535).optional());

const optionalSecurityHeadersMode = z.preprocess(
	(value) => {
		if (typeof value !== "string") return value;
		const normalized = value.trim().toLowerCase();
		return normalized.length > 0 ? normalized : undefined;
	},
	z.enum(["auto", "http", "https"]).default("auto"),
);

const EnvSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default(APP_CONFIG_DEFAULTS.nodeEnv),
	HOST: optionalTrimmedString,
	PORT: optionalPort,
	DATABASE_URL: optionalTrimmedString,
	APP_URL: optionalUrl,
	CORS_ORIGINS: optionalTrimmedString,
	SECURITY_HEADERS_MODE: optionalSecurityHeadersMode,
});

export type AppEnv = {
	nodeEnv: "development" | "test" | "production";
	host: string;
	port: number;
	databaseUrl: string;
	appUrl: string;
	corsOrigins: string[];
	securityHeadersMode: "auto" | "http" | "https";
};

function parseCorsOrigins(value?: string): string[] | undefined {
	const origins = value
		?.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean);
	return origins?.length ? origins : undefined;
}

function resolveDatabaseUrl(
	databaseUrl: string,
	nodeEnv: AppEnv["nodeEnv"],
): string {
	if (!isDatabaseConnectionUrl(databaseUrl)) return databaseUrl;
	if (nodeEnv === "production") {
		throw new Error("DATABASE_URL must be a SQLite database file path.");
	}
	return APP_CONFIG_DEFAULTS.databaseUrl;
}

export function readAppEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
	const parsed = EnvSchema.parse(env);
	const appUrl = parsed.APP_URL ?? APP_CONFIG_DEFAULTS.appUrl;
	const corsOrigins = parseCorsOrigins(parsed.CORS_ORIGINS) ?? [
		...APP_CONFIG_DEFAULTS.corsOrigins,
	];
	const appOrigin = new URL(appUrl).origin;
	if (!corsOrigins.includes(appOrigin)) corsOrigins.push(appOrigin);

	return {
		nodeEnv: parsed.NODE_ENV,
		host: parsed.HOST ?? APP_CONFIG_DEFAULTS.host,
		port: parsed.PORT ?? APP_CONFIG_DEFAULTS.port,
		databaseUrl: resolveDatabaseUrl(
			parsed.DATABASE_URL ?? APP_CONFIG_DEFAULTS.databaseUrl,
			parsed.NODE_ENV,
		),
		appUrl,
		corsOrigins,
		securityHeadersMode: parsed.SECURITY_HEADERS_MODE,
	};
}
