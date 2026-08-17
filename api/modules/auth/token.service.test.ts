import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../../app/env";
import { HttpError } from "../../app/http-error";
import type { AppDatabase, DatabaseWriter } from "../../db";
import { createSingleWriterClient } from "../../db/client";
import {
	consumeRefreshToken,
	generateAccessToken,
	generateRefreshToken,
	revokeRefreshToken,
	verifyAccessToken,
} from "./token.service";

function createMockDb() {
	return {
		query: {
			refreshTokens: {
				findFirst: vi.fn(),
			},
		},
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockReturnThis(),
		update: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
	};
}

describe("token.service", () => {
	let mockDb: ReturnType<typeof createMockDb>;
	let mockWriter: DatabaseWriter<AppDatabase>;
	let mockEnv: AppEnv;
	const testPayload = {
		userId: "a1a1a1a1-a1a1-41a1-a1a1-a1a1a1a1a1a1",
		email: "test@example.com",
		role: "member" as const,
	};

	beforeEach(() => {
		mockEnv = {
			jwtSecret: "x".repeat(32), // Min 256 bit key for HS256
			jwtAccessExpiresIn: "15m",
			jwtRefreshExpiresIn: "7d",
		} as unknown as AppEnv;

		mockDb = createMockDb();
		mockWriter = createSingleWriterClient(mockDb as unknown as AppDatabase);
	});

	describe("AccessToken", () => {
		it("should generate and verify access token", async () => {
			const token = await generateAccessToken(testPayload, mockEnv);
			expect(token).toBeDefined();

			const verified = await verifyAccessToken(token, mockEnv);
			expect(verified.userId).toBe(testPayload.userId);
			expect(verified.email).toBe(testPayload.email);
			expect(verified.role).toBe(testPayload.role);
			expect(verified.type).toBe("access");
		});

		it("should throw error when verifying an invalid access token", async () => {
			await expect(
				verifyAccessToken("invalid-token", mockEnv),
			).rejects.toThrow();
		});

		it("should throw error when verifying a refresh token as an access token", async () => {
			const refreshToken = await generateRefreshToken(
				testPayload,
				mockWriter,
				mockEnv,
			);
			await expect(verifyAccessToken(refreshToken, mockEnv)).rejects.toThrow(
				"Invalid token.",
			);
		});

		it("rejects an access token with an invalid payload", async () => {
			const token = await new SignJWT({ type: "access" })
				.setProtectedHeader({ alg: "HS256" })
				.setExpirationTime("15m")
				.sign(new TextEncoder().encode(mockEnv.jwtSecret));

			await expect(verifyAccessToken(token, mockEnv)).rejects.toThrow(
				"Invalid token.",
			);
		});
	});

	describe("RefreshToken", () => {
		it("should generate refresh token and insert hash to database", async () => {
			const token = await generateRefreshToken(
				testPayload,
				mockWriter,
				mockEnv,
			);
			expect(token).toBeDefined();
			expect(mockDb.insert).toHaveBeenCalled();
			expect(mockDb.values).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: testPayload.userId,
					token: expect.any(String),
					expiresAt: expect.any(Date),
				}),
			);
		});

		it("does not add a token to an already revoked family", async () => {
			mockDb.query.refreshTokens.findFirst.mockResolvedValue({
				id: "revoked-token-row",
			});

			await expect(
				generateRefreshToken(
					testPayload,
					mockWriter,
					mockEnv,
					"a2a2a2a2-a2a2-42a2-a2a2-a2a2a2a2a2a2",
				),
			).rejects.toThrowError(new HttpError(401, "Invalid refresh token."));
			expect(mockDb.insert).not.toHaveBeenCalled();
		});

		it("should consume a valid refresh token", async () => {
			const token = await generateRefreshToken(
				testPayload,
				mockWriter,
				mockEnv,
			);

			const oneHourInFuture = new Date(Date.now() + 60 * 60 * 1000);
			mockDb.query.refreshTokens.findFirst.mockResolvedValue({
				id: "refresh-row-id",
				userId: testPayload.userId,
				familyId: null,
				consumedAt: null,
				revokedAt: null,
				expiresAt: oneHourInFuture,
			});

			const consumed = await consumeRefreshToken(token, mockWriter, mockEnv);

			expect(consumed.payload.userId).toBe(testPayload.userId);
			expect(consumed.payload.type).toBe("refresh");
			expect(consumed.familyId).toEqual(expect.any(String));
			expect(mockDb.update).toHaveBeenCalled();
		});

		it("should throw HttpError 401 when refresh token is missing in database", async () => {
			const token = await generateRefreshToken(
				testPayload,
				mockWriter,
				mockEnv,
			);
			mockDb.query.refreshTokens.findFirst.mockResolvedValue(undefined);

			await expect(
				consumeRefreshToken(token, mockWriter, mockEnv),
			).rejects.toThrowError(new HttpError(401, "Invalid refresh token."));
		});

		it("should throw HttpError 401 when refresh token is expired", async () => {
			const token = await generateRefreshToken(
				testPayload,
				mockWriter,
				mockEnv,
			);

			const oneHourInPast = new Date(Date.now() - 60 * 60 * 1000);
			mockDb.query.refreshTokens.findFirst.mockResolvedValue({
				id: "refresh-row-id",
				userId: testPayload.userId,
				familyId: null,
				consumedAt: null,
				revokedAt: null,
				expiresAt: oneHourInPast,
			});

			await expect(
				consumeRefreshToken(token, mockWriter, mockEnv),
			).rejects.toThrowError(new HttpError(401, "Refresh token expired."));
		});

		it("should throw HttpError 401 when refresh token userId does not match", async () => {
			const token = await generateRefreshToken(
				testPayload,
				mockWriter,
				mockEnv,
			);

			const oneHourInFuture = new Date(Date.now() + 60 * 60 * 1000);
			mockDb.query.refreshTokens.findFirst.mockResolvedValue({
				id: "refresh-row-id",
				userId: "different-user-id",
				familyId: null,
				consumedAt: null,
				revokedAt: null,
				expiresAt: oneHourInFuture,
			});

			await expect(
				consumeRefreshToken(token, mockWriter, mockEnv),
			).rejects.toThrowError(new HttpError(401, "Invalid refresh token."));
		});

		it("rejects non-refresh and malformed refresh payloads", async () => {
			const secret = new TextEncoder().encode(mockEnv.jwtSecret);
			const accessToken = await new SignJWT({ ...testPayload, type: "access" })
				.setProtectedHeader({ alg: "HS256" })
				.setExpirationTime("15m")
				.sign(secret);
			await expect(
				consumeRefreshToken(accessToken, mockWriter, mockEnv),
			).rejects.toThrow("Invalid refresh token.");

			const malformedToken = await new SignJWT({ type: "refresh" })
				.setProtectedHeader({ alg: "HS256" })
				.setExpirationTime("15m")
				.sign(secret);
			await expect(
				consumeRefreshToken(malformedToken, mockWriter, mockEnv),
			).rejects.toThrow("Invalid refresh token.");
		});

		it("detects reuse and revokes the token family", async () => {
			const token = await generateRefreshToken(
				testPayload,
				mockWriter,
				mockEnv,
			);
			mockDb.query.refreshTokens.findFirst.mockResolvedValue({
				id: "refresh-row-id",
				userId: testPayload.userId,
				familyId: "a2a2a2a2-a2a2-42a2-a2a2-a2a2a2a2a2a2",
				consumedAt: new Date(),
				revokedAt: null,
				expiresAt: new Date(Date.now() + 60 * 60 * 1000),
			});

			await expect(
				consumeRefreshToken(token, mockWriter, mockEnv),
			).rejects.toThrow("Invalid refresh token.");
			expect(mockDb.set).toHaveBeenCalledWith({ revokedAt: expect.any(Date) });
		});

		it("treats an already revoked token as family reuse", async () => {
			const token = await generateRefreshToken(
				testPayload,
				mockWriter,
				mockEnv,
			);
			mockDb.query.refreshTokens.findFirst.mockResolvedValue({
				id: "refresh-row-id",
				userId: testPayload.userId,
				familyId: "a2a2a2a2-a2a2-42a2-a2a2-a2a2a2a2a2a2",
				consumedAt: null,
				revokedAt: new Date(),
				expiresAt: new Date(Date.now() + 60 * 60 * 1000),
			});

			await expect(
				consumeRefreshToken(token, mockWriter, mockEnv),
			).rejects.toThrow("Invalid refresh token.");
			expect(mockDb.update).toHaveBeenCalled();
		});

		it("rejects a refresh token whose stored family does not match", async () => {
			const token = await generateRefreshToken(
				testPayload,
				mockWriter,
				mockEnv,
			);
			mockDb.query.refreshTokens.findFirst.mockResolvedValue({
				id: "refresh-row-id",
				userId: testPayload.userId,
				familyId: "a2a2a2a2-a2a2-42a2-a2a2-a2a2a2a2a2a2",
				consumedAt: null,
				revokedAt: null,
				expiresAt: new Date(Date.now() + 60 * 60 * 1000),
			});

			await expect(
				consumeRefreshToken(token, mockWriter, mockEnv),
			).rejects.toThrow("Invalid refresh token.");
		});

		it("revokes every token in the stored family", async () => {
			mockDb.query.refreshTokens.findFirst.mockResolvedValue({
				id: "refresh-row-id",
				familyId: "a2a2a2a2-a2a2-42a2-a2a2-a2a2a2a2a2a2",
			});
			await revokeRefreshToken("revoke-me", mockWriter);
			expect(mockDb.update).toHaveBeenCalled();
			expect(mockDb.set).toHaveBeenCalledWith({ revokedAt: expect.any(Date) });
		});

		it("does nothing when revoking an unknown token", async () => {
			mockDb.query.refreshTokens.findFirst.mockResolvedValue(undefined);
			await revokeRefreshToken("unknown", mockWriter);
			expect(mockDb.update).not.toHaveBeenCalled();
		});

		it("revokes a legacy token without a family id", async () => {
			mockDb.query.refreshTokens.findFirst.mockResolvedValue({
				id: "legacy-refresh-row",
				familyId: null,
			});
			await revokeRefreshToken("legacy", mockWriter);
			expect(mockDb.update).toHaveBeenCalled();
			expect(mockDb.set).toHaveBeenCalledWith({ revokedAt: expect.any(Date) });
		});
	});
});
