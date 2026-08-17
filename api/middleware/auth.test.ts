import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app/env";
import { HttpError } from "../app/http-error";
import type { AuthService } from "../modules/auth/auth.service";
import { ACCESS_TOKEN_COOKIE_NAME } from "../modules/auth/auth-cookies";
import { generateAccessToken } from "../modules/auth/token.service";
import { requireAuth, requireRole } from "./auth";

describe("requireAuth middleware", () => {
	let app: Hono;
	let mockAuthService: { findUserById: ReturnType<typeof vi.fn> };
	let mockEnv: AppEnv;

	const testUser = {
		id: "a1a1a1a1-a1a1-41a1-a1a1-a1a1a1a1a1a1",
		email: "test@example.com",
		role: "member" as const,
		isActive: true,
	};

	beforeEach(() => {
		mockEnv = {
			jwtSecret: "x".repeat(32),
			jwtAccessExpiresIn: "15m",
			jwtRefreshExpiresIn: "7d",
		} as unknown as AppEnv;

		mockAuthService = {
			findUserById: vi.fn(),
		};

		app = new Hono();
		app.use(
			"/protected",
			requireAuth({
				env: mockEnv,
				authService: mockAuthService as unknown as AuthService,
			}),
		);
		app.get("/protected", (c) => {
			const authUser = c.get("authUser");
			return c.json({ ok: true, user: authUser });
		});

		// Global error handler mock to prevent vitest output pollution
		app.onError((err, c) => {
			const status = err instanceof HttpError ? err.status : 500;
			return c.json({ error: err.message }, status as ContentfulStatusCode);
		});
	});

	it("should allow request with valid authorization bearer token", async () => {
		mockAuthService.findUserById.mockResolvedValue(testUser);

		const token = await generateAccessToken(
			{
				userId: testUser.id,
				email: testUser.email,
				role: testUser.role,
			},
			mockEnv,
		);

		const res = await app.request("/protected", {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.user).toEqual({
			userId: testUser.id,
			email: testUser.email,
			role: testUser.role,
		});
	});

	it("should allow request with valid token cookie", async () => {
		mockAuthService.findUserById.mockResolvedValue(testUser);

		const token = await generateAccessToken(
			{
				userId: testUser.id,
				email: testUser.email,
				role: testUser.role,
			},
			mockEnv,
		);

		const res = await app.request("/protected", {
			headers: {
				Cookie: `${ACCESS_TOKEN_COOKIE_NAME}=${token}`,
			},
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.user).toBeDefined();
	});

	it("should return 401 when no token is provided", async () => {
		const res = await app.request("/protected");
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error).toBe("Unauthorized");
	});

	it("should return 401 when token is invalid", async () => {
		const res = await app.request("/protected", {
			headers: {
				Authorization: "Bearer invalid-token-string",
			},
		});
		expect(res.status).toBe(401);
	});

	it("should return 401 when user is not found or inactive", async () => {
		mockAuthService.findUserById.mockResolvedValue(null); // Not found

		const token = await generateAccessToken(
			{
				userId: testUser.id,
				email: testUser.email,
				role: testUser.role,
			},
			mockEnv,
		);

		const res = await app.request("/protected", {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});
		expect(res.status).toBe(401);

		// Inactive user
		mockAuthService.findUserById.mockResolvedValue({
			...testUser,
			isActive: false,
		});
		const res2 = await app.request("/protected", {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});
		expect(res2.status).toBe(401);
	});
});

describe("requireRole middleware", () => {
	function createRoleApp(role?: "admin" | "member") {
		const app = new Hono();
		if (role) {
			app.use("/admin", async (c, next) => {
				c.set("authUser", {
					userId: "a1a1a1a1-a1a1-41a1-a1a1-a1a1a1a1a1a1",
					email: "user@example.com",
					role,
				});
				await next();
			});
		}
		app.use("/admin", requireRole("admin"));
		app.get("/admin", (c) => c.json({ ok: true }));
		app.onError((error, c) => {
			const status = (error as HttpError).status ?? 500;
			return c.json({ message: error.message }, status as 401 | 403 | 500);
		});
		return app;
	}

	it("allows an accepted role", async () => {
		expect((await createRoleApp("admin").request("/admin")).status).toBe(200);
	});

	it("rejects an authenticated user with another role", async () => {
		expect((await createRoleApp("member").request("/admin")).status).toBe(403);
	});

	it("requires authentication context", async () => {
		expect((await createRoleApp().request("/admin")).status).toBe(401);
	});
});
