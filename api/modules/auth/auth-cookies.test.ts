import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../../app/env";
import {
	ACCESS_TOKEN_COOKIE_NAME,
	clearAuthCookies,
	REFRESH_TOKEN_COOKIE_NAME,
	setAuthCookies,
} from "./auth-cookies";

// Mock hono/cookie
vi.mock("hono/cookie", () => ({
	setCookie: vi.fn(),
	deleteCookie: vi.fn(),
}));

describe("auth-cookies", () => {
	let mockContext: Context;
	let mockEnv: AppEnv;

	beforeEach(() => {
		vi.clearAllMocks();
		mockContext = {} as unknown as Context;
		mockEnv = {
			secureCookie: true,
			cookieSameSite: "lax",
			jwtAccessExpiresIn: "15m",
			jwtRefreshExpiresIn: "7d",
		} as unknown as AppEnv;
	});

	it("should set access and refresh token cookies with correct parameters", () => {
		const tokens = {
			accessToken: "access-token-123",
			refreshToken: "refresh-token-456",
		};

		setAuthCookies(mockContext, mockEnv, tokens);

		// Access Token Cookie assertions
		expect(setCookie).toHaveBeenCalledWith(
			mockContext,
			ACCESS_TOKEN_COOKIE_NAME,
			tokens.accessToken,
			{
				httpOnly: true,
				secure: true,
				sameSite: "lax",
				path: "/",
				maxAge: 15 * 60, // 15m in seconds
			},
		);

		// Refresh Token Cookie assertions
		expect(setCookie).toHaveBeenCalledWith(
			mockContext,
			REFRESH_TOKEN_COOKIE_NAME,
			tokens.refreshToken,
			{
				httpOnly: true,
				secure: true,
				sameSite: "lax",
				path: "/api/auth",
				maxAge: 7 * 24 * 60 * 60, // 7d in seconds
			},
		);
	});

	it("should handle duration parsing for different units (s, h, d, invalid)", () => {
		const tokens = { accessToken: "act", refreshToken: "rft" };

		// Seconds "s" and Hours "h"
		mockEnv.jwtAccessExpiresIn = "30s";
		mockEnv.jwtRefreshExpiresIn = "2h";
		setAuthCookies(mockContext, mockEnv, tokens);

		expect(setCookie).toHaveBeenNthCalledWith(
			1,
			mockContext,
			ACCESS_TOKEN_COOKIE_NAME,
			tokens.accessToken,
			expect.objectContaining({ maxAge: 30 }),
		);
		expect(setCookie).toHaveBeenNthCalledWith(
			2,
			mockContext,
			REFRESH_TOKEN_COOKIE_NAME,
			tokens.refreshToken,
			expect.objectContaining({ maxAge: 2 * 60 * 60 }),
		);

		// Invalid durations (should omit maxAge)
		vi.clearAllMocks();
		mockEnv.jwtAccessExpiresIn = "invalid";
		mockEnv.jwtRefreshExpiresIn = "-5d"; // invalid pattern
		setAuthCookies(mockContext, mockEnv, tokens);

		expect(setCookie).toHaveBeenNthCalledWith(
			1,
			mockContext,
			ACCESS_TOKEN_COOKIE_NAME,
			tokens.accessToken,
			{
				httpOnly: true,
				secure: true,
				sameSite: "lax",
				path: "/",
			},
		);
		expect(setCookie).toHaveBeenNthCalledWith(
			2,
			mockContext,
			REFRESH_TOKEN_COOKIE_NAME,
			tokens.refreshToken,
			{
				httpOnly: true,
				secure: true,
				sameSite: "lax",
				path: "/api/auth",
			},
		);

		vi.clearAllMocks();
		mockEnv.jwtAccessExpiresIn = "0s";
		mockEnv.jwtRefreshExpiresIn = "0m";
		setAuthCookies(mockContext, mockEnv, tokens);
		expect(setCookie).toHaveBeenNthCalledWith(
			1,
			mockContext,
			ACCESS_TOKEN_COOKIE_NAME,
			tokens.accessToken,
			expect.not.objectContaining({ maxAge: expect.anything() }),
		);
	});

	it("should clear auth cookies", () => {
		clearAuthCookies(mockContext);
		expect(deleteCookie).toHaveBeenCalledWith(
			mockContext,
			ACCESS_TOKEN_COOKIE_NAME,
			{ path: "/" },
		);
		expect(deleteCookie).toHaveBeenCalledWith(
			mockContext,
			REFRESH_TOKEN_COOKIE_NAME,
			{ path: "/api/auth" },
		);
	});
});
