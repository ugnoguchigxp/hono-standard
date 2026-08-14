export const APP_CONFIG_DEFAULTS = {
	nodeEnv: "development",
	host: "127.0.0.1",
	port: 5173,
	databaseUrl: "file:sqlite.db",
	appUrl: "http://localhost:5173",
	corsOrigins: ["http://localhost:5173"],
} as const;
