import { z } from "zod";
import {
	type UserRole,
	userRoleSchema,
} from "../../../shared/schemas/auth.schema";

export type { UserRole };
export { userRoleSchema };

export const jwtPayloadSchema = z.object({
	userId: z.string().uuid(),
	email: z.string().email(),
	role: userRoleSchema,
	type: z.enum(["access", "refresh"]),
	jti: z.string().optional(),
	familyId: z.string().uuid().optional(),
});
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;

export type AuthUser = {
	id: string;
	email: string;
	passwordHash: string;
	displayName: string;
	role: UserRole;
	isActive: boolean;
	lastLoginAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

export type AuthSessionUser = Pick<
	AuthUser,
	"id" | "email" | "displayName" | "role"
>;
