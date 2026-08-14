import { describe, expect, it } from "vitest";
import {
	protectedAdminResponseSchema,
	protectedProfileResponseSchema,
} from "./protected.schema";

describe("protectedProfileResponseSchema", () => {
	it("accepts a valid protected profile response", () => {
		const result = protectedProfileResponseSchema.safeParse({
			profile: {
				email: "admin@example.com",
				role: "admin",
			},
		});

		expect(result.success).toBe(true);
	});

	it("rejects an invalid protected profile response", () => {
		const result = protectedProfileResponseSchema.safeParse({
			profile: {
				email: "not-an-email",
				role: "owner",
			},
		});

		expect(result.success).toBe(false);
	});
});

describe("protectedAdminResponseSchema", () => {
	it("accepts the minimal admin response", () => {
		expect(
			protectedAdminResponseSchema.parse({
				admin: { email: "admin@example.com" },
			}),
		).toEqual({ admin: { email: "admin@example.com" } });
	});
});
