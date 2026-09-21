import type { BrainEvent } from "../core/types";
const less = (a: BrainEvent, b: BrainEvent) =>
	a.atMs !== b.atMs
		? a.atMs < b.atMs
		: a.phase !== b.phase
			? a.phase < b.phase
			: a.sequence < b.sequence;
export class EventQueue {
	private heap: BrainEvent[] = [];
	private sequence = 0;
	constructor(private readonly limit = 100000) {}
	get size() {
		return this.heap.length;
	}
	peek() {
		return this.heap[0];
	}
	push(event: Omit<BrainEvent, "sequence">): BrainEvent {
		if (this.heap.length >= this.limit) throw new RangeError("queue_limit");
		const item = { ...event, sequence: this.sequence++ };
		this.heap.push(item);
		let i = this.heap.length - 1;
		for (; i; ) {
			const p = (i - 1) >> 1;
			const parent = this.heap[p];
			if (!parent || !less(item, parent)) break;
			this.heap[i] = parent;
			i = p;
		}
		this.heap[i] = item;
		return item;
	}
	pop(): BrainEvent | undefined {
		const top = this.heap[0];
		const last = this.heap.pop();
		if (!top || !last || this.heap.length === 0) return top;
		let i = 0;
		while (true) {
			let child = i * 2 + 1;
			if (child >= this.heap.length) break;
			const left = this.heap[child];
			const right = this.heap[child + 1];
			if (left && right && less(right, left)) child++;
			const next = this.heap[child];
			if (!next || !less(next, last)) break;
			this.heap[i] = next;
			i = child;
		}
		this.heap[i] = last;
		return top;
	}
}
