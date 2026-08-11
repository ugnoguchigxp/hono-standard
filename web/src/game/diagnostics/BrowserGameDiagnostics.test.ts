import { describe, expect, it } from "vitest";
import { BrowserGameDiagnostics } from "./BrowserGameDiagnostics";

const makeRecord = (sequence: number) => ({
	version: 1 as const,
	event: "runtime.start" as const,
	correlationId: "rpg-001122aabbcc" as const,
	occurredAt: "2026-08-11T00:00:00.000Z",
	sequence,
});

describe("BrowserGameDiagnostics", () => {
	it("retains only the latest 100 records and returns snapshot copies", () => {
		const diagnostics = new BrowserGameDiagnostics();
		for (let sequence = 0; sequence <= 100; sequence += 1) {
			diagnostics.record(makeRecord(sequence));
		}

		const snapshot = diagnostics.snapshot();
		expect(snapshot).toHaveLength(100);
		expect(snapshot[0]?.sequence).toBe(1);
		expect(snapshot[99]?.sequence).toBe(100);
		expect(snapshot[0]).not.toBe(diagnostics.snapshot()[0]);

		diagnostics.clear();
		expect(diagnostics.snapshot()).toEqual([]);
	});

	it("captures valid records and isolates invalid diagnostic input", () => {
		const diagnostics = new BrowserGameDiagnostics();
		expect(
			diagnostics.capture({
				event: "save.write",
				correlationId: "rpg-001122aabbcc",
				occurredAt: "2026-08-11T00:00:00.000Z",
			}),
		).toMatchObject({ event: "save.write" });
		expect(
			diagnostics.capture({
				event: "runtime.start",
				correlationId: "invalid",
			}),
		).toBeNull();
		expect(diagnostics.snapshot()).toHaveLength(1);
	});
});
