import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app/env";
import { HttpError } from "../app/http-error";
import { requireAuth } from "../middleware/auth";
import type { AuthService } from "../modules/auth/auth.service";
import {
	ACCESS_TOKEN_COOKIE_NAME,
	REFRESH_TOKEN_COOKIE_NAME,
} from "../modules/auth/auth-cookies";
import { createAuthRoute } from "./auth.route";

describe("auth route", () => {
	let app: Hono;
	let mockAuthService: {
		login: ReturnType<typeof vi.fn>;
		refresh: ReturnType<typeof vi.fn>;
		logout: ReturnType<typeof vi.fn>;
		findUserById: ReturnType<typeof vi.fn>;
	};
	let mockEnv: AppEnv;

	const testUser = {
		id: "a1a1a1a1-a1a1-41a1-a1a1-a1a1a1a1a1a1",
		email: "test@example.com",
		displayName: "Test User",
		role: "member" as const,
		isActive: true,
	};

	beforeEach(() => {
		mockEnv = {
			jwtSecret: "x".repeat(32),
			jwtAccessExpiresIn: "15m",
			jwtRefreshExpiresIn: "7d",
			loginRateLimitMaxAttempts: 2,
			loginRateLimitWindowSeconds: 60,
			secureCookie: true,
			cookieSameSite: "lax",
		} as unknown as AppEnv;

		mockAuthService = {
			login: vi.fn(),
			refresh: vi.fn(),
			logout: vi.fn(),
			findUserById: vi.fn(),
		};

		app = new Hono();
		// Set error handler to prevent throwing unhandled exceptions in tests
		app.onError((err, c) => {
			const status = err instanceof HttpError ? err.status : 500;
			return c.json({ message: err.message }, status as ContentfulStatusCode);
		});

		app.use(
			"/auth/me",
			requireAuth({
				env: mockEnv,
				authService: mockAuthService as unknown as AuthService,
			}),
		);
		app.route(
			"/auth",
			createAuthRoute({
				authService: mockAuthService as unknown as AuthService,
				env: mockEnv,
			}),
		);
	});

	describe("POST /login", () => {
		it("should login user with valid credentials and set cookies", async () => {
			mockAuthService.login.mockResolvedValue({
				accessToken: "access-token-123",
				refreshToken: "refresh-token-456",
				user: {
					id: testUser.id,
					email: testUser.email,
					displayName: testUser.displayName,
					role: testUser.role,
				},
			});

			const res = await app.request("/auth/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email: "test@example.com",
					password: "password123",
				}),
			});

			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.user.email).toBe(testUser.email);
			expect(mockAuthService.login).toHaveBeenCalledWith({
				email: "test@example.com",
				password: "password123",
			});

			// Check set-cookie headers
			const cookies = res.headers.getSetCookie();
			expect(cookies.some((c) => c.includes(ACCESS_TOKEN_COOKIE_NAME))).toBe(
				true,
			);
			expect(cookies.some((c) => c.includes(REFRESH_TOKEN_COOKIE_NAME))).toBe(
				true,
			);
		});

		it("should return validation error for invalid email format", async () => {
			const res = await app.request("/auth/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email: "invalid-email",
					password: "pwd",
				}),
			});

			expect(res.status).toBe(400); // Validation error
		});

		it("rate limits repeated login attempts and returns Retry-After", async () => {
			mockAuthService.login.mockRejectedValue(
				new HttpError(401, "Invalid email or password."),
			);
			const request = () =>
				app.request("/auth/login", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						email: "blocked@example.com",
						password: "wrong",
					}),
				});

			expect((await request()).status).toBe(401);
			expect((await request()).status).toBe(401);
			const blocked = await request();
			expect(blocked.status).toBe(429);
			expect(blocked.headers.get("Retry-After")).toBe("60");
			expect(mockAuthService.login).toHaveBeenCalledTimes(2);
		});

		it("resets the account limit after a successful login", async () => {
			const successfulLogin = {
				accessToken: "access-token-123",
				refreshToken: "refresh-token-456",
				user: {
					id: testUser.id,
					email: testUser.email,
					displayName: testUser.displayName,
					role: testUser.role,
				},
			};
			mockAuthService.login
				.mockRejectedValueOnce(new HttpError(401, "Invalid email or password."))
				.mockResolvedValueOnce(successfulLogin)
				.mockRejectedValueOnce(
					new HttpError(401, "Invalid email or password."),
				);
			const request = () =>
				app.request("/auth/login", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						email: "reset@example.com",
						password: "password123",
					}),
				});

			expect((await request()).status).toBe(401);
			expect((await request()).status).toBe(200);
			expect((await request()).status).toBe(401);
		});
	});

	describe("POST /refresh", () => {
		it("should refresh tokens using refresh cookie", async () => {
			mockAuthService.refresh.mockResolvedValue({
				accessToken: "new-access-token",
				refreshToken: "new-refresh-token",
				user: {
					id: testUser.id,
					email: testUser.email,
					displayName: testUser.displayName,
					role: testUser.role,
				},
			});

			const res = await app.request("/auth/refresh", {
				method: "POST",
				headers: {
					Cookie: `${REFRESH_TOKEN_COOKIE_NAME}=old-refresh-token`,
				},
			});

			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.user.id).toBe(testUser.id);
			expect(mockAuthService.refresh).toHaveBeenCalledWith("old-refresh-token");

			// New cookies should be set
			const cookies = res.headers.getSetCookie();
			expect(cookies.some((c) => c.includes("new-access-token"))).toBe(true);
		});

		it("should throw HttpError 401 when no refresh token cookie is present", async () => {
			const res = await app.request("/auth/refresh", {
				method: "POST",
			});

			expect(res.status).toBe(401);
			const body = await res.json();
			expect(body.message).toBe("Unauthorized");
		});
	});

	describe("POST /logout", () => {
		it("should call logout service and clear cookies", async () => {
			const res = await app.request("/auth/logout", {
				method: "POST",
				headers: {
					Cookie: `${REFRESH_TOKEN_COOKIE_NAME}=my-refresh-token`,
				},
			});

			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.ok).toBe(true);
			expect(mockAuthService.logout).toHaveBeenCalledWith("my-refresh-token");

			// Cookies should be cleared (max-age=0 or expires in past)
			const cookies = res.headers.getSetCookie();
			expect(
				cookies.some((c) => c.includes("Max-Age=0") || c.includes("1970")),
			).toBe(true);
		});
	});

	describe("GET /me", () => {
		it("should return user details when authenticated", async () => {
			// Pre-calculate a valid JWT access token
			const { generateAccessToken } = await import(
				"../modules/auth/token.service"
			);
			const token = await generateAccessToken(
				{
					userId: testUser.id,
					email: testUser.email,
					role: testUser.role,
				},
				mockEnv,
			);

			mockAuthService.findUserById.mockResolvedValue(testUser);

			const res = await app.request("/auth/me", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.user.email).toBe(testUser.email);
			expect(body.user.displayName).toBe(testUser.displayName);
		});

		it("should throw 401 when user in token is inactive in db", async () => {
			const { generateAccessToken } = await import(
				"../modules/auth/token.service"
			);
			const token = await generateAccessToken(
				{
					userId: testUser.id,
					email: testUser.email,
					role: testUser.role,
				},
				mockEnv,
			);

			// User is inactive in database
			mockAuthService.findUserById.mockResolvedValue({
				...testUser,
				isActive: false,
			});

			const res = await app.request("/auth/me", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			expect(res.status).toBe(401);
		});

		it("should throw 401 when the token user no longer exists", async () => {
			const { generateAccessToken } = await import(
				"../modules/auth/token.service"
			);
			const token = await generateAccessToken(
				{
					userId: testUser.id,
					email: testUser.email,
					role: testUser.role,
				},
				mockEnv,
			);
			mockAuthService.findUserById.mockResolvedValue(null);

			const res = await app.request("/auth/me", {
				headers: { Authorization: `Bearer ${token}` },
			});

			expect(res.status).toBe(401);
		});
	});
});
