import { eq } from "drizzle-orm";
import type { AppEnv } from "../../app/env";
import type { AppDatabaseClient } from "../../db";
import { refreshTokens, users } from "../../db/schema";
import { HttpError } from "./errors";
import { hashPassword, verifyPassword } from "./password";
import {
	consumeRefreshToken,
	generateAccessToken,
	generateRefreshToken,
	revokeRefreshToken,
} from "./token.service";
import {
	type AuthSessionUser,
	type AuthUser,
	type UserRole,
	userRoleSchema,
} from "./types";

type AuthTokensResult = {
	accessToken: string;
	refreshToken: string;
	user: AuthSessionUser;
};

type CreateUserInput = {
	email: string;
	displayName: string;
	password: string;
	role?: UserRole;
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const normalizeRole = (role: string): UserRole => {
	const parsed = userRoleSchema.safeParse(role);
	return parsed.success ? parsed.data : "member";
};

const toAuthUser = (row: typeof users.$inferSelect): AuthUser => ({
	id: row.id,
	email: row.email,
	passwordHash: row.passwordHash,
	displayName: row.displayName,
	role: normalizeRole(row.role),
	isActive: row.isActive,
	lastLoginAt: row.lastLoginAt,
	createdAt: row.createdAt,
	updatedAt: row.updatedAt,
});

const toSessionUser = (user: AuthUser): AuthSessionUser => ({
	id: user.id,
	email: user.email,
	displayName: user.displayName,
	role: user.role,
});

export class AuthService {
	constructor(
		private readonly database: AppDatabaseClient,
		private readonly env: AppEnv,
	) {}

	async findUserById(userId: string): Promise<AuthUser | null> {
		const row = await this.database.read.query.users.findFirst({
			where: eq(users.id, userId),
		});
		return row ? toAuthUser(row) : null;
	}

	async findUserByEmail(email: string): Promise<AuthUser | null> {
		const row = await this.database.read.query.users.findFirst({
			where: eq(users.email, normalizeEmail(email)),
		});
		return row ? toAuthUser(row) : null;
	}

	private async issueTokens(user: AuthUser): Promise<AuthTokensResult> {
		const accessToken = await generateAccessToken(
			{
				userId: user.id,
				email: user.email,
				role: user.role,
			},
			this.env,
		);
		const refreshToken = await generateRefreshToken(
			{
				userId: user.id,
				email: user.email,
				role: user.role,
			},
			this.database.write,
			this.env,
		);
		return {
			accessToken,
			refreshToken,
			user: toSessionUser(user),
		};
	}

	async login(params: {
		email: string;
		password: string;
	}): Promise<AuthTokensResult> {
		const user = await this.findUserByEmail(params.email);
		if (!user?.isActive) {
			throw new HttpError(401, "Invalid email or password.");
		}
		const valid = await verifyPassword(params.password, user.passwordHash);
		if (!valid) {
			throw new HttpError(401, "Invalid email or password.");
		}
		const now = new Date();
		await this.database.write.execute((db) =>
			db
				.update(users)
				.set({ lastLoginAt: now, updatedAt: now })
				.where(eq(users.id, user.id)),
		);
		const refreshed = await this.findUserById(user.id);
		if (!refreshed) {
			throw new HttpError(404, "User not found.");
		}
		return this.issueTokens(refreshed);
	}

	async refresh(refreshToken: string): Promise<AuthTokensResult> {
		const payload = await consumeRefreshToken(
			refreshToken,
			this.database.write,
			this.env,
		);
		const user = await this.findUserById(payload.userId);
		if (!user?.isActive) {
			throw new HttpError(401, "User account is inactive or deleted.");
		}
		return this.issueTokens(user);
	}

	async logout(refreshToken?: string): Promise<void> {
		if (!refreshToken) return;
		await revokeRefreshToken(refreshToken, this.database.write);
	}

	async createAdmin(input: Omit<CreateUserInput, "role">): Promise<AuthUser> {
		const existing = await this.findUserByEmail(input.email);
		if (existing) {
			throw new HttpError(409, "Email already in use.");
		}
		const passwordHash = await hashPassword(input.password);
		const [created] = await this.database.write.execute((db) =>
			db
				.insert(users)
				.values({
					email: normalizeEmail(input.email),
					passwordHash,
					displayName: input.displayName,
					role: "admin",
					isActive: true,
				})
				.returning(),
		);
		return toAuthUser(created);
	}

	async seedDevelopmentAdmin(
		input: Omit<CreateUserInput, "role">,
	): Promise<{ user: AuthUser; action: "created" | "updated" }> {
		const existing = await this.findUserByEmail(input.email);
		if (!existing) {
			return {
				user: await this.createAdmin(input),
				action: "created",
			};
		}

		const now = new Date();
		const passwordHash = await hashPassword(input.password);
		const [updated] = await this.database.write.execute(async (db) => {
			const result = await db
				.update(users)
				.set({
					email: normalizeEmail(input.email),
					passwordHash,
					displayName: input.displayName,
					role: "admin",
					isActive: true,
					updatedAt: now,
				})
				.where(eq(users.id, existing.id))
				.returning();
			await db
				.delete(refreshTokens)
				.where(eq(refreshTokens.userId, existing.id));
			return result;
		});
		if (!updated) {
			throw new HttpError(404, "User not found.");
		}
		return { user: toAuthUser(updated), action: "updated" };
	}
}
