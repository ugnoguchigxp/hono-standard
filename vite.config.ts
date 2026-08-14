import path from "node:path";
import devServer from "@hono/vite-dev-server";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import {
	serializeContentSecurityPolicy,
	viteDevContentSecurityPolicy,
} from "./api/app/security-headers";
import { APP_CONFIG_DEFAULTS } from "./api/config/appDefaults";

export default defineConfig(({ mode }) => {
	// Load env file from project root (one level up from 'web' root)
	const env = loadEnv(mode, __dirname, "");
	Object.assign(process.env, env);

	return {
		root: "web",
		plugins: [
			tailwindcss(),
			react(),
			devServer({
				entry: path.resolve(__dirname, "api/app/hono.ts"),
				exclude: [/^\/(?!api(?:\/|$)).*/],
				injectClientScript: false,
			}),
		],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./web/src"),
				"@web": path.resolve(__dirname, "./web/src"),
				"@api": path.resolve(__dirname, "./api"),
				"@shared": path.resolve(__dirname, "./shared"),
			},
		},
		server: {
			host: APP_CONFIG_DEFAULTS.host,
			port: APP_CONFIG_DEFAULTS.port,
			headers: {
				"Content-Security-Policy": serializeContentSecurityPolicy(
					viteDevContentSecurityPolicy,
				),
				"Referrer-Policy": "no-referrer",
				"X-Content-Type-Options": "nosniff",
				"X-DNS-Prefetch-Control": "off",
				"X-Frame-Options": "SAMEORIGIN",
			},
		},
		build: {
			outDir: "../dist-web",
			emptyOutDir: true,
			rolldownOptions: {
				output: {
					codeSplitting: {
						groups: [
							{
								name: "react-runtime",
								test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
								priority: 50,
							},
							{
								name: "tanstack-table",
								test: /node_modules[\\/]@tanstack[\\/](?:react-table|table-core)[\\/]/,
								priority: 40,
							},
							{
								name: "tanstack-router",
								test: /node_modules[\\/]@tanstack[\\/](?:react-router|router-core|history|react-store|store)[\\/]/,
								priority: 40,
							},
							{
								name: "tanstack-query",
								test: /node_modules[\\/]@tanstack[\\/](?:react-query|query-core)[\\/]/,
								priority: 40,
							},
							{
								name: "icons",
								test: /node_modules[\\/]lucide-react[\\/]/,
								priority: 30,
							},
							{
								name: "vendor",
								test: /node_modules/,
								priority: 10,
							},
						],
					},
				},
			},
		},
	};
});
