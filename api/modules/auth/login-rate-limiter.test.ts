import { describe, expect, it } from "vitest";
import {
	InMemoryLoginRateLimiter,
	loginRateLimitKey,
} from "./login-rate-limiter";

describe("InMemoryLoginRateLimiter", () => {
	it("blocks attempts until the fixed window expires", () => {
		let now = 1_000;
		const limiter = new InMemoryLoginRateLimiter({
			maxAttempts: 2,
			windowMs: 5_000,
			now: () => now,
		});

		expect(limiter.consume("user@example.com").allowed).toBe(true);
		expect(limiter.consume("user@example.com").allowed).toBe(true);
		expect(limiter.consume("user@example.com")).toEqual({
			allowed: false,
			retryAfterSeconds: 5,
		});

		now = 6_000;
		expect(limiter.consume("user@example.com").allowed).toBe(true);
	});

	it("resets an account after a successful login", () => {
		const limiter = new InMemoryLoginRateLimiter({
			maxAttempts: 1,
			windowMs: 5_000,
		});

		expect(limiter.consume("user@example.com").allowed).toBe(true);
		expect(limiter.consume("user@example.com").allowed).toBe(false);
		limiter.reset("user@example.com");
		expect(limiter.consume("user@example.com").allowed).toBe(true);
	});

	it("evicts the oldest entry when its bounded storage is full", () => {
		const limiter = new InMemoryLoginRateLimiter({
			maxAttempts: 1,
			windowMs: 5_000,
			maxEntries: 1,
		});

		limiter.consume("first@example.com");
		limiter.consume("second@example.com");
		expect(limiter.consume("first@example.com").allowed).toBe(true);
	});

	it("prunes expired entries before evicting active accounts", () => {
		let now = 0;
		const limiter = new InMemoryLoginRateLimiter({
			maxAttempts: 1,
			windowMs: 1_000,
			maxEntries: 2,
			now: () => now,
		});
		limiter.consume("first@example.com");
		limiter.consume("second@example.com");
		now = 1_000;
		expect(limiter.consume("third@example.com").allowed).toBe(true);
	});

	it("rejects invalid configuration and normalizes account keys", () => {
		expect(
			() => new InMemoryLoginRateLimiter({ maxAttempts: 0, windowMs: 1_000 }),
		).toThrow(/positive/);
		expect(
			() => new InMemoryLoginRateLimiter({ maxAttempts: 1, windowMs: 0 }),
		).toThrow(/positive/);
		expect(
			() =>
				new InMemoryLoginRateLimiter({
					maxAttempts: 1,
					windowMs: 1_000,
					maxEntries: 0,
				}),
		).toThrow(/positive/);
		expect(loginRateLimitKey(" User@Example.COM ")).toBe("user@example.com");
	});
});
