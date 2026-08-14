export type LoginRateLimitDecision = {
	allowed: boolean;
	retryAfterSeconds: number;
};

export type LoginRateLimiter = {
	consume: (key: string) => LoginRateLimitDecision;
	reset: (key: string) => void;
};

type LoginRateLimitEntry = {
	attempts: number;
	resetAt: number;
};

type InMemoryLoginRateLimiterOptions = {
	maxAttempts: number;
	windowMs: number;
	maxEntries?: number;
	now?: () => number;
};

export class InMemoryLoginRateLimiter implements LoginRateLimiter {
	private readonly entries = new Map<string, LoginRateLimitEntry>();
	private readonly maxAttempts: number;
	private readonly windowMs: number;
	private readonly maxEntries: number;
	private readonly now: () => number;

	constructor(options: InMemoryLoginRateLimiterOptions) {
		const maxEntries = options.maxEntries ?? 10_000;
		if (
			!Number.isSafeInteger(options.maxAttempts) ||
			options.maxAttempts < 1 ||
			!Number.isFinite(options.windowMs) ||
			options.windowMs < 1 ||
			!Number.isSafeInteger(maxEntries) ||
			maxEntries < 1
		) {
			throw new Error("Login rate limit values must be positive.");
		}
		this.maxAttempts = options.maxAttempts;
		this.windowMs = options.windowMs;
		this.maxEntries = maxEntries;
		this.now = options.now ?? Date.now;
	}

	consume(key: string): LoginRateLimitDecision {
		const now = this.now();
		const existing = this.entries.get(key);
		if (!existing || existing.resetAt <= now) {
			this.makeRoom(now);
			this.entries.set(key, {
				attempts: 1,
				resetAt: now + this.windowMs,
			});
			return { allowed: true, retryAfterSeconds: 0 };
		}

		const retryAfterSeconds = Math.max(
			1,
			Math.ceil((existing.resetAt - now) / 1000),
		);
		if (existing.attempts >= this.maxAttempts) {
			return { allowed: false, retryAfterSeconds };
		}

		existing.attempts += 1;
		return { allowed: true, retryAfterSeconds };
	}

	reset(key: string): void {
		this.entries.delete(key);
	}

	private makeRoom(now: number): void {
		if (this.entries.size < this.maxEntries) return;
		for (const [key, entry] of this.entries) {
			if (entry.resetAt <= now) this.entries.delete(key);
		}
		if (this.entries.size < this.maxEntries) return;
		const oldestKey = this.entries.keys().next().value;
		if (typeof oldestKey === "string") this.entries.delete(oldestKey);
	}
}

export function loginRateLimitKey(email: string): string {
	return email.trim().toLowerCase();
}
