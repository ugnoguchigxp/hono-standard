import {
	createGameDiagnosticRecord,
	type GameDiagnosticRecord,
	type GameDiagnosticsSink,
} from "@shared/game";

const MAX_RECORDS = 100;

export class BrowserGameDiagnostics implements GameDiagnosticsSink {
	private readonly records: GameDiagnosticRecord[] = [];

	record(record: GameDiagnosticRecord): void {
		this.records.push(record);
		if (this.records.length > MAX_RECORDS) this.records.shift();
	}

	capture(
		input: Parameters<typeof createGameDiagnosticRecord>[0],
	): GameDiagnosticRecord | null {
		try {
			const record = createGameDiagnosticRecord(input);
			this.record(record);
			return record;
		} catch {
			return null;
		}
	}

	snapshot(): readonly GameDiagnosticRecord[] {
		return this.records.map((record) => ({ ...record }));
	}

	clear(): void {
		this.records.length = 0;
	}
}

export const browserGameDiagnostics = new BrowserGameDiagnostics();
