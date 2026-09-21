export class Recorder<T extends { simTimeMs: number }> {
	private records: T[] = [];
	constructor(
		private readonly maxRecords = 10_000,
		private readonly windowMs = 60_000,
	) {}
	push(record: T): void {
		this.records.push(structuredClone(record));
		while (
			this.records.length > this.maxRecords ||
			(this.records[0] &&
				record.simTimeMs - this.records[0].simTimeMs > this.windowMs)
		)
			this.records.shift();
	}
	drain(): T[] {
		const result = this.records;
		this.records = [];
		return result;
	}
	read(): readonly T[] {
		return structuredClone(this.records);
	}
}
