export class Mulberry32 {
	private state: number;
	constructor(seed: number) {
		if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
			throw new RangeError("seed must be uint32");
		this.state = seed >>> 0;
	}
	next(): number {
		this.state += 0x6d2b79f5;
		let t = this.state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}
	int(maxExclusive: number): number {
		if (!Number.isInteger(maxExclusive) || maxExclusive <= 0)
			throw new RangeError("maxExclusive must be positive");
		return Math.floor(this.next() * maxExclusive);
	}
}
function hash(seed: number, tag: string): number {
	let h = seed >>> 0;
	for (const char of tag) {
		h ^= char.charCodeAt(0);
		h = Math.imul(h, 0x5bd1e995) >>> 0;
	}
	return h >>> 0;
}
export function createRandomStreams(seed: number) {
	return Object.freeze({
		topology: new Mulberry32(hash(seed, "topology:v1")),
		world: new Mulberry32(hash(seed, "world:v1")),
		sensory: new Mulberry32(hash(seed, "sensory:v1")),
		structural: new Mulberry32(hash(seed, "structural:v1")),
		action: new Mulberry32(hash(seed, "action:v1")),
	});
}
