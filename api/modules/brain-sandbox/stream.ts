const encoder = new TextEncoder();
const MAX_QUEUED_BYTES = 1_048_576;
type Subscriber = {
	controller: ReadableStreamDefaultController<Uint8Array>;
	heartbeat: ReturnType<typeof setInterval>;
	lifetime: ReturnType<typeof setTimeout>;
	ownerId: string;
};

export class BrainStreamHub {
	private readonly subscribers = new Map<string, Set<Subscriber>>();
	private readonly sequences = new Map<string, number>();
	private readonly ownerCounts = new Map<string, number>();
	stream(
		runId: string,
		ownerId: string,
		snapshot: unknown,
	): ReadableStream<Uint8Array> {
		if ((this.ownerCounts.get(ownerId) ?? 0) >= 2)
			throw new Error("subscriber_limit");
		let subscriber: Subscriber | undefined;
		return new ReadableStream(
			{
				start: (controller) => {
					this.ownerCounts.set(
						ownerId,
						(this.ownerCounts.get(ownerId) ?? 0) + 1,
					);
					subscriber = {
						controller,
						ownerId,
						heartbeat: setInterval(() => {
							if (
								controller.desiredSize !== null &&
								controller.desiredSize <= 0
							) {
								if (subscriber) this.remove(runId, subscriber);
								return;
							}
							controller.enqueue(encoder.encode(": heartbeat\n\n"));
						}, 10_000),
						lifetime: setTimeout(() => {
							if (subscriber) this.remove(runId, subscriber);
						}, 60_000),
					};
					const set = this.subscribers.get(runId) ?? new Set<Subscriber>();
					set.add(subscriber);
					this.subscribers.set(runId, set);
					controller.enqueue(
						encoder.encode(
							`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`,
						),
					);
				},
				cancel: () => {
					if (subscriber) this.remove(runId, subscriber);
				},
			},
			{
				highWaterMark: MAX_QUEUED_BYTES,
				size: (chunk) => chunk?.byteLength ?? 0,
			},
		);
	}
	publish(runId: string, payload: unknown): void {
		const sequence = (this.sequences.get(runId) ?? 0) + 1;
		this.sequences.set(runId, sequence);
		const message = encoder.encode(
			`event: batch\nid: ${sequence}\ndata: ${JSON.stringify({ ...(payload as object), sequence })}\n\n`,
		);
		for (const subscriber of this.subscribers.get(runId) ?? []) {
			try {
				if (
					message.byteLength > MAX_QUEUED_BYTES ||
					(subscriber.controller.desiredSize !== null &&
						subscriber.controller.desiredSize < message.byteLength)
				) {
					this.remove(runId, subscriber);
					continue;
				}
				subscriber.controller.enqueue(message);
			} catch {
				this.remove(runId, subscriber);
			}
		}
	}
	close(): void {
		for (const [, set] of this.subscribers)
			for (const subscriber of set) {
				clearInterval(subscriber.heartbeat);
				clearTimeout(subscriber.lifetime);
				try {
					subscriber.controller.close();
				} catch {}
			}
		this.subscribers.clear();
		this.ownerCounts.clear();
		this.sequences.clear();
	}
	private remove(runId: string, target?: Subscriber): void {
		const set = this.subscribers.get(runId);
		if (!set) return;
		if (target) {
			clearInterval(target.heartbeat);
			clearTimeout(target.lifetime);
			try {
				target.controller.close();
			} catch {}
			this.ownerCounts.set(
				target.ownerId,
				Math.max(0, (this.ownerCounts.get(target.ownerId) ?? 1) - 1),
			);
			set.delete(target);
		} else {
			for (const subscriber of set) {
				clearInterval(subscriber.heartbeat);
				clearTimeout(subscriber.lifetime);
				try {
					subscriber.controller.close();
				} catch {}
				this.ownerCounts.set(
					subscriber.ownerId,
					Math.max(0, (this.ownerCounts.get(subscriber.ownerId) ?? 1) - 1),
				);
			}
			set.clear();
		}
		if (!set.size) this.subscribers.delete(runId);
	}
}
