export const APP_CONFIG_DEFAULTS = {
	nodeEnv: "development",
	host: "127.0.0.1",
	port: 5173,
	databaseUrl: "postgres://postgres:postgres@localhost:5432/hono_standard",
	appUrl: "http://localhost:5173",
	corsOrigins: ["http://localhost:5173"],
} as const;
