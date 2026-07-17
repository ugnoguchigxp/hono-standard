import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../../app/env";
import type { AppDatabase, AppDatabaseClient } from "../../db";
import { createSingleWriterClient } from "../../db/client";
import { AuthService } from "./auth.service";
import { HttpError } from "./errors";
import { hashPassword, verifyPassword } from "./password";

describe("AuthService", () => {
	let mockDb: any;
	let mockDatabaseClient: AppDatabaseClient;
	let mockEnv: AppEnv;
	let authService: AuthService;

	const testUserRow = {
		id: "a1a1a1a1-a1a1-41a1-a1a1-a1a1a1a1a1a1",
		email: "test@example.com",
		passwordHash: "", // Will be filled dynamically in tests
		displayName: "Test User",
		role: "member",
		isActive: true,
		lastLoginAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	beforeEach(async () => {
		mockEnv = {
			jwtSecret: "x".repeat(32),
			jwtAccessExpiresIn: "15m",
			jwtRefreshExpiresIn: "7d",
		} as unknown as AppEnv;

		mockDb = {
			query: {
				users: {
					findFirst: vi.fn(),
				},
			},
			update: vi.fn().mockReturnThis(),
			set: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			insert: vi.fn().mockReturnThis(),
			values: vi.fn().mockReturnThis(),
			returning: vi.fn(),
			delete: vi.fn().mockReturnThis(),
		};

		const database = mockDb as unknown as AppDatabase;
		mockDatabaseClient = {
			read: database,
			write: createSingleWriterClient(database),
		};
		authService = new AuthService(mockDatabaseClient, mockEnv);

		const passwordHash = await hashPassword("password123");
		testUserRow.passwordHash = passwordHash;
	});

	describe("findUserById", () => {
		it("should return mapped user when found", async () => {
			mockDb.query.users.findFirst.mockResolvedValue(testUserRow);

			const user = await authService.findUserById(testUserRow.id);
			expect(mockDb.query.users.findFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.any(Object),
				}),
			);
			expect(user).toBeDefined();
			expect(user?.id).toBe(testUserRow.id);
			expect(user?.role).toBe("member");
		});

		it("should return null when not found", async () => {
			mockDb.query.users.findFirst.mockResolvedValue(null);

			const user = await authService.findUserById("non-existent");
			expect(user).toBeNull();
		});
	});

	describe("findUserByEmail", () => {
		it("should query user by trimmed lowercase email", async () => {
			mockDb.query.users.findFirst.mockResolvedValue(testUserRow);

			const user = await authService.findUserByEmail("  TEST@example.com ");
			expect(user).toBeDefined();
			expect(user?.email).toBe(testUserRow.email);
		});
	});

	describe("login", () => {
		it("should login successfully and return tokens", async () => {
			mockDb.query.users.findFirst.mockResolvedValue(testUserRow);

			// Mock db.update for lastLoginAt
			mockDb.returning.mockResolvedValue(undefined);

			// mock generateRefreshToken (db.insert)
			mockDb.insert.mockReturnThis();
			mockDb.values.mockResolvedValue(undefined);

			const result = await authService.login({
				email: testUserRow.email,
				password: "password123",
			});

			expect(result.accessToken).toBeDefined();
			expect(result.refreshToken).toBeDefined();
			expect(result.user.email).toBe(testUserRow.email);
			expect(mockDb.update).toHaveBeenCalled();
		});

		it("should throw HttpError 401 for invalid credentials", async () => {
			mockDb.query.users.findFirst.mockResolvedValue(testUserRow);

			await expect(
				authService.login({
					email: testUserRow.email,
					password: "wrong-password",
				}),
			).rejects.toThrowError(new HttpError(401, "Invalid email or password."));
		});

		it("should throw HttpError 401 when user is inactive", async () => {
			const inactiveUser = { ...testUserRow, isActive: false };
			mockDb.query.users.findFirst.mockResolvedValue(inactiveUser);

			await expect(
				authService.login({
					email: testUserRow.email,
					password: "password123",
				}),
			).rejects.toThrowError(new HttpError(401, "Invalid email or password."));
		});

		it("should throw HttpError 404 if user cannot be retrieved after update", async () => {
			// First call for findUserByEmail returns user, second call for findUserById returns null
			mockDb.query.users.findFirst
				.mockResolvedValueOnce(testUserRow)
				.mockResolvedValueOnce(null);

			await expect(
				authService.login({
					email: testUserRow.email,
					password: "password123",
				}),
			).rejects.toThrowError(new HttpError(404, "User not found."));
		});
	});

	describe("refresh", () => {
		it("should refresh tokens using valid refresh token", async () => {
			// First we need a real refresh token
			// We can generate one using token.service or we can just mock consumeRefreshToken.
			// Let's import token.service and mock the db response so we can call authService.refresh.
			const mockInsertDb = {
				insert: vi.fn().mockReturnThis(),
				values: vi.fn().mockResolvedValue(undefined),
			};

			const { generateRefreshToken } = await import("./token.service");
			const token = await generateRefreshToken(
				{
					userId: testUserRow.id,
					email: testUserRow.email,
					role: "member",
				},
				createSingleWriterClient(mockInsertDb as any),
				mockEnv,
			);

			// Mock consumeRefreshToken db delete
			mockDb.returning.mockResolvedValueOnce([
				{
					userId: testUserRow.id,
					expiresAt: new Date(Date.now() + 60 * 60 * 1000),
				},
			]);

			// Mock findUserById
			mockDb.query.users.findFirst.mockResolvedValue(testUserRow);

			const result = await authService.refresh(token);
			expect(result.accessToken).toBeDefined();
			expect(result.refreshToken).toBeDefined();
		});

		it("should throw HttpError 401 when refreshed user is inactive", async () => {
			const { generateRefreshToken } = await import("./token.service");
			const token = await generateRefreshToken(
				{
					userId: testUserRow.id,
					email: testUserRow.email,
					role: "member",
				},
				createSingleWriterClient({
					insert: vi.fn().mockReturnThis(),
					values: vi.fn().mockResolvedValue(undefined),
				} as any),
				mockEnv,
			);

			mockDb.returning.mockResolvedValueOnce([
				{
					userId: testUserRow.id,
					expiresAt: new Date(Date.now() + 60 * 60 * 1000),
				},
			]);

			// Inactive user
			const inactiveUser = { ...testUserRow, isActive: false };
			mockDb.query.users.findFirst.mockResolvedValue(inactiveUser);

			await expect(authService.refresh(token)).rejects.toThrowError(
				new HttpError(401, "User account is inactive or deleted."),
			);
		});
	});

	describe("logout", () => {
		it("should revoke refresh token if provided", async () => {
			await authService.logout("refresh-token");
			expect(mockDb.delete).toHaveBeenCalled();
		});

		it("should do nothing when token is not provided", async () => {
			await authService.logout(undefined);
			expect(mockDb.delete).not.toHaveBeenCalled();
		});
	});

	describe("createAdmin", () => {
		it("should create new admin user successfully", async () => {
			mockDb.query.users.findFirst.mockResolvedValue(null); // No existing email

			const newAdminRow = {
				...testUserRow,
				email: "admin@example.com",
				role: "admin",
			};
			mockDb.returning.mockResolvedValue([newAdminRow]);

			const admin = await authService.createAdmin({
				email: "admin@example.com",
				displayName: "Admin",
				password: "password123456",
			});

			expect(admin.email).toBe("admin@example.com");
			expect(admin.role).toBe("admin");
			expect(mockDb.insert).toHaveBeenCalled();
		});

		it("should throw HttpError 409 when email is already in use", async () => {
			mockDb.query.users.findFirst.mockResolvedValue(testUserRow); // Email already in use

			await expect(
				authService.createAdmin({
					email: testUserRow.email,
					displayName: "Admin",
					password: "password123456",
				}),
			).rejects.toThrowError(new HttpError(409, "Email already in use."));
		});
	});

	describe("seedDevelopmentAdmin", () => {
		it("creates the configured development admin when missing", async () => {
			mockDb.query.users.findFirst.mockResolvedValue(null);
			const createdRow = {
				...testUserRow,
				email: "admin@example.com",
				displayName: "Admin User",
				role: "admin",
			};
			mockDb.returning.mockResolvedValue([createdRow]);

			const result = await authService.seedDevelopmentAdmin({
				email: " Admin@Example.com ",
				displayName: "Admin User",
				password: "password123456",
			});

			expect(result.action).toBe("created");
			expect(result.user.email).toBe("admin@example.com");
			expect(mockDb.insert).toHaveBeenCalled();
		});

		it("resets an existing development admin to the configured credentials", async () => {
			const existingRow = {
				...testUserRow,
				email: "admin@example.com",
				displayName: "Old Admin",
				role: "member",
				isActive: false,
			};
			const updatedRow = {
				...existingRow,
				displayName: "Admin User",
				role: "admin",
				isActive: true,
			};
			mockDb.query.users.findFirst.mockResolvedValue(existingRow);
			mockDb.returning.mockResolvedValue([updatedRow]);

			const result = await authService.seedDevelopmentAdmin({
				email: "admin@example.com",
				displayName: "Admin User",
				password: "password123456",
			});

			expect(result.action).toBe("updated");
			expect(result.user.role).toBe("admin");
			expect(result.user.isActive).toBe(true);
			expect(mockDb.update).toHaveBeenCalled();
			expect(mockDb.delete).toHaveBeenCalled();
			expect(mockDb.set).toHaveBeenCalledWith(
				expect.objectContaining({
					displayName: "Admin User",
					role: "admin",
					isActive: true,
					passwordHash: expect.stringMatching(/^s1\$/),
				}),
			);
			const updateValues = mockDb.set.mock.calls.at(-1)?.[0];
			expect(
				await verifyPassword("password123456", updateValues.passwordHash),
			).toBe(true);
		});

		it("fails if the existing development admin disappears during update", async () => {
			mockDb.query.users.findFirst.mockResolvedValue(testUserRow);
			mockDb.returning.mockResolvedValue([]);

			await expect(
				authService.seedDevelopmentAdmin({
					email: testUserRow.email,
					displayName: "Admin User",
					password: "password123456",
				}),
			).rejects.toThrowError(new HttpError(404, "User not found."));
		});
	});
});
