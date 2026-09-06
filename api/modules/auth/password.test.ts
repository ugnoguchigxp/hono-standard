import { scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashPassword, passwordNeedsRehash, verifyPassword } from "./password";

describe("password hashing and verification", () => {
	it("should hash a password and verify it successfully", async () => {
		const password = "my-secure-password";
		const hash = await hashPassword(password);

		expect(hash).toBeDefined();
		expect(hash).toContain("$");
		expect(hash.startsWith("s2$")).toBe(true);
		const [, salt, derived] = hash.split("$");
		expect(derived).toBe(
			scryptSync(password, salt, 64, { N: 16384, r: 8, p: 5 }).toString("hex"),
		);
		expect(passwordNeedsRehash(hash)).toBe(false);

		const isValid = await verifyPassword(password, hash);
		expect(isValid).toBe(true);
	});

	it("accepts legacy s1 hashes and identifies them for upgrade", async () => {
		const salt = "12".repeat(16);
		const derived = scryptSync("legacy-password", salt, 64, {
			N: 16384,
			r: 8,
			p: 1,
		});
		const hash = `s1$${salt}$${derived.toString("hex")}`;
		expect(await verifyPassword("legacy-password", hash)).toBe(true);
		expect(await verifyPassword("wrong-password", hash)).toBe(false);
		expect(passwordNeedsRehash(hash)).toBe(true);
	});

	it.each([
		`s2$invalid-salt$${"00".repeat(64)}`,
		`s2$${"00".repeat(16)}$${"gg".repeat(64)}`,
		`s2$${"00".repeat(16)}$${"00".repeat(64)}$extra`,
		`s3$${"00".repeat(16)}$${"00".repeat(64)}`,
	])("rejects malformed encodings: %s", async (hash) => {
		expect(await verifyPassword("password", hash)).toBe(false);
	});

	it("should fail verification with incorrect password", async () => {
		const password = "my-secure-password";
		const hash = await hashPassword(password);

		const isValid = await verifyPassword("wrong-password", hash);
		expect(isValid).toBe(false);
	});

	it("should return false if prefix is incorrect or hash format is invalid", async () => {
		// Wrong prefix
		expect(await verifyPassword("password", "s2$salt$derived")).toBe(false);

		// Missing parts
		expect(await verifyPassword("password", "s1$salt")).toBe(false);
		expect(await verifyPassword("password", "s1")).toBe(false);
		expect(await verifyPassword("password", "")).toBe(false);
	});

	it("should return false if stored derived key length differs from new derived key", async () => {
		const password = "my-secure-password";
		// scrypt outputs key with length SCRYPT_KEY_LENGTH (64 bytes), which is 128 hex characters.
		// Let's provide a hash with a derived key of incorrect length (e.g. 10 characters / 5 bytes).
		const salt = "00".repeat(16);
		const shortHexHash = `s1$${salt}$abcde12345`;

		const isValid = await verifyPassword(password, shortHexHash);
		expect(isValid).toBe(false);
	});
});
