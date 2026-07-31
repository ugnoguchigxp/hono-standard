import { readAppEnv } from "../api/app/env";
import { createDbConnection } from "../api/db";
import { AuthService } from "../api/modules/auth/auth.service";
import { HttpError } from "../api/modules/auth/errors";

const email = process.env.DEV_ADMIN_EMAIL ?? "admin@example.com";
const displayName = process.env.DEV_ADMIN_NAME ?? "Admin User";
const password = process.env.DEV_ADMIN_PASSWORD ?? "password123456";

const env = readAppEnv();
if (env.nodeEnv === "production") {
	throw new Error("seed:dev cannot run in production.");
}

const dbConnection = createDbConnection(env.databaseUrl);
try {
	const authService = new AuthService(dbConnection.db, env);
	const user = await authService.createAdmin({
		email,
		displayName,
		password,
	});
	console.log(
		JSON.stringify(
			{
				ok: true,
				user: {
					id: user.id,
					email: user.email,
					displayName: user.displayName,
					role: user.role,
				},
			},
			null,
			2,
		),
	);
} catch (error) {
	if (error instanceof HttpError && error.status === 409) {
		console.log(
			JSON.stringify(
				{
					ok: true,
					skipped: true,
					reason: "admin user already exists",
					email,
				},
				null,
				2,
			),
		);
	} else {
		throw error;
	}
} finally {
	if ("end" in dbConnection.pgClient) {
		await dbConnection.pgClient.end();
	}
}
