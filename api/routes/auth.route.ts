import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { loginSchema } from "../../shared/schemas/auth.schema";
import type { AppEnv } from "../app/env";
import type { AuthService } from "../modules/auth/auth.service";
import {
	REFRESH_TOKEN_COOKIE_NAME,
	clearAuthCookies,
	setAuthCookies,
} from "../modules/auth/auth-cookies";
import { getAuthContextUser } from "../modules/auth/context";
import { HttpError } from "../app/http-error";
import {
	InMemoryLoginRateLimiter,
	loginRateLimitKey,
	type LoginRateLimiter,
} from "../modules/auth/login-rate-limiter";

type AuthRouteDeps = {
	authService: AuthService;
	env: AppEnv;
	loginRateLimiter?: LoginRateLimiter;
};

export function createAuthRoute(deps: AuthRouteDeps) {
	const loginRateLimiter =
		deps.loginRateLimiter ??
		new InMemoryLoginRateLimiter({
			maxAttempts: deps.env.loginRateLimitMaxAttempts,
			windowMs: deps.env.loginRateLimitWindowSeconds * 1000,
		});

	return new Hono()
		.post("/login", zValidator("json", loginSchema), async (c) => {
			const body = c.req.valid("json");
			const rateLimitKey = loginRateLimitKey(body.email);
			const decision = loginRateLimiter.consume(rateLimitKey);
			if (!decision.allowed) {
				c.header("Retry-After", String(decision.retryAfterSeconds));
				throw new HttpError(429, "Too many login attempts. Try again later.");
			}
			const result = await deps.authService.login({
				email: body.email,
				password: body.password,
			});
			loginRateLimiter.reset(rateLimitKey);
			setAuthCookies(c, deps.env, result);
			return c.json({ user: result.user });
		})
		.post("/refresh", async (c) => {
			const refreshToken = getCookie(c, REFRESH_TOKEN_COOKIE_NAME);
			if (!refreshToken) {
				throw new HttpError(401, "Unauthorized");
			}
			const result = await deps.authService.refresh(refreshToken);
			setAuthCookies(c, deps.env, result);
			return c.json({ user: result.user });
		})
		.post("/logout", async (c) => {
			const refreshToken = getCookie(c, REFRESH_TOKEN_COOKIE_NAME);
			await deps.authService.logout(refreshToken);
			clearAuthCookies(c);
			return c.json({ ok: true });
		})
		.get("/me", async (c) => {
			const authUser = getAuthContextUser(c);
			const user = await deps.authService.findUserById(authUser.userId);
			if (!user?.isActive) {
				throw new HttpError(401, "Unauthorized");
			}
			return c.json({
				user: {
					id: user.id,
					email: user.email,
					displayName: user.displayName,
					role: user.role,
				},
			});
		});
}
