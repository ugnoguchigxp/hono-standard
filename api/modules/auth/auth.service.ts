import { and, desc, eq, ne, sql } from "drizzle-orm";
import type { AppEnv } from "../../app/env";
import type { AppDatabaseClient } from "../../db";
import { users } from "../../db/schema";
import { HttpError } from "../../app/http-error";
import { hashPassword, passwordNeedsRehash, verifyPassword } from "./password";
import {
	consumeRefreshToken,
	generateAccessToken,
	generateRefreshToken,
	revokeAllRefreshTokensForUser,
	revokeRefreshToken,
} from "./token.service";
import {
	userRoleSchema,
	type AuthSessionUser,
	type AuthUser,
	type UserRole,
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
			where: eq(users.email, email.toLowerCase()),
		});
		return row ? toAuthUser(row) : null;
	}

	private async issueTokens(
		user: AuthUser,
		refreshTokenFamilyId?: string,
	): Promise<AuthTokensResult> {
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
			refreshTokenFamilyId,
		);
		return {
			accessToken,
			refreshToken,
			user: toSessionUser(user),
		};
	}

	private async countActiveAdmins(excludeUserId?: string): Promise<number> {
		const filters = [
			eq(users.role, "admin"),
			eq(users.isActive, true),
			...(excludeUserId ? [ne(users.id, excludeUserId)] : []),
		];
		const [result] = await this.database.read
			.select({ count: sql<number>`cast(count(*) as integer)` })
			.from(users)
			.where(and(...filters));
		return result?.count ?? 0;
	}

	private async assertCanRemoveAdminPrivileges(
		targetUser: AuthUser,
	): Promise<void> {
		if (targetUser.role !== "admin" || !targetUser.isActive) {
			return;
		}
		const activeAdminCount = await this.countActiveAdmins(targetUser.id);
		if (activeAdminCount === 0) {
			throw new HttpError(
				400,
				"At least one active admin account is required.",
			);
		}
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
		const passwordHash = passwordNeedsRehash(user.passwordHash)
			? await hashPassword(params.password)
			: user.passwordHash;
		const now = new Date();
		await this.database.write.execute((db) =>
			db
				.update(users)
				.set({ lastLoginAt: now, updatedAt: now, passwordHash })
				.where(
					and(eq(users.id, user.id), eq(users.passwordHash, user.passwordHash)),
				),
		);
		const refreshed = await this.findUserById(user.id);
		if (!refreshed) {
			throw new HttpError(404, "User not found.");
		}
		return this.issueTokens(refreshed);
	}

	async refresh(refreshToken: string): Promise<AuthTokensResult> {
		const consumed = await consumeRefreshToken(
			refreshToken,
			this.database.write,
			this.env,
		);
		const user = await this.findUserById(consumed.payload.userId);
		if (!user?.isActive) {
			throw new HttpError(401, "User account is inactive or deleted.");
		}
		return this.issueTokens(user, consumed.familyId);
	}

	async logout(refreshToken?: string): Promise<void> {
		if (!refreshToken) return;
		await revokeRefreshToken(refreshToken, this.database.write);
	}

	async listUsers(): Promise<AuthUser[]> {
		const rows = await this.database.read
			.select()
			.from(users)
			.orderBy(desc(users.createdAt));
		return rows.map((row) => toAuthUser(row));
	}

	async createUser(input: CreateUserInput): Promise<AuthUser> {
		const existing = await this.findUserByEmail(input.email);
		if (existing) {
			throw new HttpError(409, "Email already in use.");
		}
		const passwordHash = await hashPassword(input.password);
		const [created] = await this.database.write.execute((db) =>
			db
				.insert(users)
				.values({
					email: input.email.toLowerCase(),
					passwordHash,
					displayName: input.displayName,
					role: input.role ?? "member",
					isActive: true,
				})
				.returning(),
		);
		return toAuthUser(created);
	}

	async createAdmin(input: Omit<CreateUserInput, "role">): Promise<AuthUser> {
		return this.createUser({
			...input,
			role: "admin",
		});
	}

	async updateUserProfile(
		targetUserId: string,
		input: {
			displayName?: string;
			role?: UserRole;
		},
	): Promise<AuthUser> {
		const target = await this.findUserById(targetUserId);
		if (!target) {
			throw new HttpError(404, "User not found.");
		}

		if (input.role && target.role === "admin" && input.role !== "admin") {
			await this.assertCanRemoveAdminPrivileges(target);
		}

		const [updated] = await this.database.write.execute((db) =>
			db
				.update(users)
				.set({
					displayName: input.displayName ?? target.displayName,
					role: input.role ?? target.role,
					updatedAt: new Date(),
				})
				.where(eq(users.id, targetUserId))
				.returning(),
		);
		return toAuthUser(updated);
	}

	async setUserActive(
		actorUserId: string,
		targetUserId: string,
		isActive: boolean,
	): Promise<AuthUser> {
		if (actorUserId === targetUserId && !isActive) {
			throw new HttpError(400, "You cannot disable your own account.");
		}

		const target = await this.findUserById(targetUserId);
		if (!target) {
			throw new HttpError(404, "User not found.");
		}

		if (!isActive) {
			await this.assertCanRemoveAdminPrivileges(target);
			await revokeAllRefreshTokensForUser(target.id, this.database.write);
		}

		const [updated] = await this.database.write.execute((db) =>
			db
				.update(users)
				.set({
					isActive,
					updatedAt: new Date(),
				})
				.where(eq(users.id, targetUserId))
				.returning(),
		);
		return toAuthUser(updated);
	}

	async resetPassword(
		targetUserId: string,
		newPassword: string,
	): Promise<void> {
		const target = await this.findUserById(targetUserId);
		if (!target) {
			throw new HttpError(404, "User not found.");
		}
		const passwordHash = await hashPassword(newPassword);
		await this.database.write.execute((db) =>
			db
				.update(users)
				.set({
					passwordHash,
					updatedAt: new Date(),
				})
				.where(eq(users.id, targetUserId)),
		);
		await revokeAllRefreshTokensForUser(targetUserId, this.database.write);
	}
}
