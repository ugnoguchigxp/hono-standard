import { createHash, randomUUID } from "node:crypto";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import type { AppDatabase, DatabaseWriter } from "../../db";
import { SignJWT, jwtVerify } from "jose";
import { refreshTokens } from "../../db/schema";
import type { AppEnv } from "../../app/env";
import { HttpError } from "../../app/http-error";
import { jwtPayloadSchema, type JwtPayload } from "./types";

const hashToken = (token: string): string =>
	createHash("sha256").update(token).digest("hex");

const secretKey = (jwtSecret: string): Uint8Array =>
	new TextEncoder().encode(jwtSecret);

type JwtCorePayload = Omit<JwtPayload, "type">;

async function verifyJwtPayload(token: string, env: AppEnv) {
	try {
		return await jwtVerify(token, secretKey(env.jwtSecret));
	} catch {
		throw new HttpError(401, "Invalid token.");
	}
}

export async function generateAccessToken(
	payload: JwtCorePayload,
	env: AppEnv,
): Promise<string> {
	return new SignJWT({ ...payload, type: "access" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setJti(randomUUID())
		.setExpirationTime(env.jwtAccessExpiresIn)
		.sign(secretKey(env.jwtSecret));
}

export async function generateRefreshToken(
	payload: JwtCorePayload,
	writer: DatabaseWriter<AppDatabase>,
	env: AppEnv,
	familyId: string = randomUUID(),
): Promise<string> {
	const token = await new SignJWT({ ...payload, type: "refresh", familyId })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setJti(randomUUID())
		.setExpirationTime(env.jwtRefreshExpiresIn)
		.sign(secretKey(env.jwtSecret));

	const verified = await jwtVerify(token, secretKey(env.jwtSecret));
	const exp = verified.payload.exp;
	if (typeof exp !== "number") {
		throw new HttpError(500, "Failed to parse refresh token expiration.");
	}
	await writer.execute(async (db) => {
		const revokedFamily = await db.query.refreshTokens.findFirst({
			where: and(
				eq(refreshTokens.familyId, familyId),
				isNotNull(refreshTokens.revokedAt),
			),
			columns: { id: true },
		});
		if (revokedFamily) {
			throw new HttpError(401, "Invalid refresh token.");
		}
		await db
			.delete(refreshTokens)
			.where(lt(refreshTokens.expiresAt, new Date()));
		await db.insert(refreshTokens).values({
			token: hashToken(token),
			userId: payload.userId,
			familyId,
			expiresAt: new Date(exp * 1000),
		});
	});

	return token;
}

export async function verifyAccessToken(
	token: string,
	env: AppEnv,
): Promise<JwtPayload> {
	const verified = await verifyJwtPayload(token, env);
	if (verified.payload.type !== "access") {
		throw new HttpError(401, "Invalid token.");
	}
	const parsed = jwtPayloadSchema.safeParse(verified.payload);
	if (!parsed.success) {
		throw new HttpError(401, "Invalid token.");
	}
	return parsed.data;
}

export async function consumeRefreshToken(
	token: string,
	writer: DatabaseWriter<AppDatabase>,
	env: AppEnv,
): Promise<{ payload: JwtPayload; familyId: string }> {
	const verified = await verifyJwtPayload(token, env);
	if (verified.payload.type !== "refresh") {
		throw new HttpError(401, "Invalid refresh token.");
	}
	const parsed = jwtPayloadSchema.safeParse(verified.payload);
	if (!parsed.success) {
		throw new HttpError(401, "Invalid refresh token.");
	}
	const payload = parsed.data;
	const tokenHash = hashToken(token);
	const now = new Date();
	const outcome = await writer.execute(async (db) => {
		const stored = await db.query.refreshTokens.findFirst({
			where: eq(refreshTokens.token, tokenHash),
		});
		if (!stored) return { status: "missing" as const };

		const familyId = stored.familyId ?? payload.familyId ?? stored.id;
		if (stored.consumedAt || stored.revokedAt) {
			await db
				.update(refreshTokens)
				.set({ revokedAt: now })
				.where(eq(refreshTokens.familyId, familyId));
			return { status: "reused" as const };
		}
		if (now > stored.expiresAt) return { status: "expired" as const };
		if (
			payload.userId !== stored.userId ||
			(stored.familyId &&
				payload.familyId &&
				stored.familyId !== payload.familyId)
		) {
			return { status: "mismatch" as const };
		}

		await db
			.update(refreshTokens)
			.set({ consumedAt: now, familyId })
			.where(eq(refreshTokens.id, stored.id));
		return { status: "consumed" as const, familyId };
	});

	if (outcome.status === "expired") {
		throw new HttpError(401, "Refresh token expired.");
	}
	if (outcome.status !== "consumed") {
		throw new HttpError(401, "Invalid refresh token.");
	}
	return { payload, familyId: outcome.familyId };
}

export async function revokeRefreshToken(
	token: string,
	writer: DatabaseWriter<AppDatabase>,
): Promise<void> {
	const tokenHash = hashToken(token);
	await writer.execute(async (db) => {
		const stored = await db.query.refreshTokens.findFirst({
			where: eq(refreshTokens.token, tokenHash),
		});
		if (!stored) return;
		const now = new Date();
		if (stored.familyId) {
			await db
				.update(refreshTokens)
				.set({ revokedAt: now })
				.where(eq(refreshTokens.familyId, stored.familyId));
			return;
		}
		await db
			.update(refreshTokens)
			.set({ revokedAt: now })
			.where(eq(refreshTokens.id, stored.id));
	});
}
