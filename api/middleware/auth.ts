import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../app/env";
import { HttpError } from "../app/http-error";
import type { AuthService } from "../modules/auth/auth.service";
import { ACCESS_TOKEN_COOKIE_NAME } from "../modules/auth/auth-cookies";
import { getAuthContextUser } from "../modules/auth/context";
import { verifyAccessToken } from "../modules/auth/token.service";
import type { UserRole } from "../modules/auth/types";

type AuthMiddlewareDeps = {
	env: AppEnv;
	authService: AuthService;
};

const unauthorized = new HttpError(401, "Unauthorized");

const resolveToken = (
	authorizationHeader: string | undefined,
	cookieToken?: string,
) => {
	if (authorizationHeader?.startsWith("Bearer ")) {
		return authorizationHeader.slice("Bearer ".length).trim();
	}
	return cookieToken ?? null;
};

export const requireAuth = (deps: AuthMiddlewareDeps) =>
	createMiddleware(async (c, next) => {
		const token = resolveToken(
			c.req.header("Authorization"),
			getCookie(c, ACCESS_TOKEN_COOKIE_NAME),
		);
		if (!token) {
			throw unauthorized;
		}

		const payload = await verifyAccessToken(token, deps.env).catch(() => {
			throw unauthorized;
		});
		const user = await deps.authService.findUserById(payload.userId);
		if (!user?.isActive) {
			throw unauthorized;
		}

		c.set("authUser", {
			userId: user.id,
			email: user.email,
			role: user.role,
		});
		await next();
	});

export const requireRole = (role: UserRole, ...additionalRoles: UserRole[]) => {
	const allowedRoles = new Set([role, ...additionalRoles]);
	return createMiddleware(async (c, next) => {
		const authUser = getAuthContextUser(c);
		if (!allowedRoles.has(authUser.role)) {
			throw new HttpError(403, "Forbidden");
		}
		await next();
	});
};
