import { readAppEnv } from "../api/app/env";
import { createDbRuntime } from "../api/db";
import { AuthService } from "../api/modules/auth/auth.service";
import { z } from "zod";

const developmentAdminSchema = z.object({
	email: z.string().trim().email(),
	displayName: z.string().trim().min(1).max(100),
	password: z.string().min(8).max(256),
});

const { email, displayName, password } = developmentAdminSchema.parse({
	email: process.env.DEV_ADMIN_EMAIL ?? "admin@example.com",
	displayName: process.env.DEV_ADMIN_NAME ?? "Admin User",
	password: process.env.DEV_ADMIN_PASSWORD ?? "password123456",
});

const env = readAppEnv();
if (env.nodeEnv === "production") {
	throw new Error("seed:dev cannot run in production.");
}

const dbRuntime = createDbRuntime(env);
try {
	const authService = new AuthService(dbRuntime.client, env);
	const result = await authService.seedDevelopmentAdmin({
		email,
		displayName,
		password,
	});
	console.log(
		JSON.stringify(
			{
				ok: true,
				action: result.action,
				user: {
					id: result.user.id,
					email: result.user.email,
					displayName: result.user.displayName,
					role: result.user.role,
				},
			},
			null,
			2,
		),
	);
} finally {
	await dbRuntime.close();
}
