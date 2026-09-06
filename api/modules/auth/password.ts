import {
	randomBytes,
	scrypt as scryptCallback,
	timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
	password: string | Buffer,
	salt: string | Buffer,
	keylen: number,
	options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;
const SCRYPT_PREFIX = "s2";
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
	N: 16384,
	r: 8,
	p: 5,
	maxmem: 128 * 1024 * 1024,
} as const;

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString("hex");
	const derived = (await scrypt(
		password,
		salt,
		SCRYPT_KEY_LENGTH,
		SCRYPT_OPTIONS,
	)) as Buffer;
	return `${SCRYPT_PREFIX}$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(
	password: string,
	storedHash: string,
): Promise<boolean> {
	const [prefix, salt, storedHex, extra] = storedHash.split("$");
	if (
		(prefix !== "s1" && prefix !== SCRYPT_PREFIX) ||
		!salt ||
		!/^[a-f0-9]{32}$/i.test(salt) ||
		!storedHex ||
		!/^[a-f0-9]{128}$/i.test(storedHex) ||
		extra !== undefined
	) {
		return false;
	}

	const derived = (await scrypt(password, salt, SCRYPT_KEY_LENGTH, {
		...SCRYPT_OPTIONS,
		p: prefix === "s1" ? 1 : SCRYPT_OPTIONS.p,
	})) as Buffer;
	const stored = Buffer.from(storedHex, "hex");
	return timingSafeEqual(stored, derived);
}

/** s1 uses the legacy work factor; upgrade only after successful verification. */
export function passwordNeedsRehash(storedHash: string): boolean {
	return storedHash.startsWith("s1$");
}
