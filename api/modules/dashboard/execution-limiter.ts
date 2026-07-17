import { throwIfAborted } from "./abort-signals";

export class DashboardExecutionLimitError extends Error {
	constructor(
		message: string,
		readonly code:
			| "EXECUTION_LIMIT_REACHED"
			| "REQUEST_CANCELLED" = "EXECUTION_LIMIT_REACHED",
	) {
		super(message);
		this.name = "DashboardExecutionLimitError";
	}
}

type Waiter = {
	resolve: (release: () => void) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
	signal: AbortSignal;
	onAbort: () => void;
	settled: boolean;
};

export class DashboardExecutionLimiter {
	private active = 0;
	private readonly queue: Waiter[] = [];
	private readonly maxConcurrent: number;
	private readonly queueTimeoutMs: number;
	private readonly maxQueued: number;
	constructor(options: {
		maxConcurrent: number;
		queueTimeoutMs: number;
		maxQueued: number;
	}) {
		this.maxConcurrent = options.maxConcurrent;
		this.queueTimeoutMs = options.queueTimeoutMs;
		this.maxQueued = options.maxQueued;
		const { maxConcurrent, queueTimeoutMs, maxQueued } = options;
		if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1)
			throw new RangeError("maxConcurrent must be positive");
		if (!Number.isInteger(queueTimeoutMs) || queueTimeoutMs < 1)
			throw new RangeError("queueTimeoutMs must be positive");
		if (!Number.isInteger(maxQueued) || maxQueued < 0)
			throw new RangeError("maxQueued must be non-negative");
	}

	get activeCount() {
		return this.active;
	}
	get queuedCount() {
		return this.queue.length;
	}

	acquire(signal: AbortSignal): Promise<() => void> {
		throwIfAborted(signal);
		if (this.active < this.maxConcurrent) {
			this.active += 1;
			return Promise.resolve(this.release());
		}
		if (this.queue.length >= this.maxQueued)
			return Promise.reject(
				new DashboardExecutionLimitError("Dashboard execution queue is full"),
			);
		return new Promise((resolve, reject) => {
			const waiter: Waiter = {
				resolve,
				reject,
				signal,
				timer: undefined as unknown as ReturnType<typeof setTimeout>,
				onAbort: () => undefined,
				settled: false,
			};
			const settle = (action: () => void) => {
				if (waiter.settled) return;
				waiter.settled = true;
				clearTimeout(waiter.timer);
				signal.removeEventListener("abort", waiter.onAbort);
				action();
			};
			waiter.timer = setTimeout(() => {
				settle(() => {
					const index = this.queue.indexOf(waiter);
					if (index >= 0) this.queue.splice(index, 1);
					reject(
						new DashboardExecutionLimitError(
							"Dashboard execution queue timed out",
						),
					);
				});
			}, this.queueTimeoutMs);
			this.queue.push(waiter);
			waiter.onAbort = () =>
				settle(() => {
					const index = this.queue.indexOf(waiter);
					if (index >= 0) this.queue.splice(index, 1);
					reject(
						new DashboardExecutionLimitError(
							"Dashboard execution was cancelled",
							"REQUEST_CANCELLED",
						),
					);
				});
			signal.addEventListener("abort", waiter.onAbort, { once: true });
		});
	}

	private release() {
		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.active = Math.max(0, this.active - 1);
			this.drain();
		};
	}

	private drain() {
		while (this.active < this.maxConcurrent && this.queue.length > 0) {
			const waiter = this.queue.shift();
			if (!waiter) return;
			clearTimeout(waiter.timer);
			if (waiter.signal.aborted) {
				waiter.onAbort();
				continue;
			}
			if (waiter.settled) continue;
			waiter.settled = true;
			waiter.signal.removeEventListener("abort", waiter.onAbort);
			this.active += 1;
			waiter.resolve(this.release());
		}
	}
}
