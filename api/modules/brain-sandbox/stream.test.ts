import { afterEach, describe, expect, it, vi } from "vitest";
import { BrainStreamHub } from "./stream";

describe("BrainStreamHub", () => {
	afterEach(() => vi.useRealTimers());
	it("sends a snapshot followed by sequenced batches", async () => {
		const hub = new BrainStreamHub();
		const reader = hub.stream("run-1", "user", { simTimeMs: 0 }).getReader();
		expect(new TextDecoder().decode((await reader.read()).value)).toContain(
			"event: snapshot",
		);
		hub.publish("run-1", { simTimeMs: 100 });
		const batch = new TextDecoder().decode((await reader.read()).value);
		expect(batch).toContain("event: batch");
		expect(batch).toContain('"sequence":1');
		await reader.cancel();
		hub.close();
	});
	it("limits subscriptions per owner", async () => {
		const hub = new BrainStreamHub();
		const first = hub.stream("a", "user", {}).getReader();
		const second = hub.stream("b", "user", {}).getReader();
		expect(() => hub.stream("c", "user", {})).toThrow("subscriber_limit");
		await first.cancel();
		expect(() => hub.stream("c", "user", {})).not.toThrow();
		await second.cancel();
		hub.close();
	});
	it("drops a subscriber rather than buffering a payload over one MiB", async () => {
		const hub = new BrainStreamHub();
		const reader = hub.stream("run", "user", {}).getReader();
		await reader.read();
		hub.publish("run", { value: "x".repeat(1_048_576) });
		expect(() => hub.stream("other", "user", {})).not.toThrow();
		await reader.cancel();
		hub.close();
	});
	it("releases a subscription after its 60-second lifetime", async () => {
		vi.useFakeTimers();
		const hub = new BrainStreamHub();
		const first = hub.stream("a", "user", {}).getReader();
		const second = hub.stream("b", "user", {}).getReader();
		expect(() => hub.stream("c", "user", {})).toThrow("subscriber_limit");
		await vi.advanceTimersByTimeAsync(60_000);
		expect(() => hub.stream("c", "user", {})).not.toThrow();
		await first.cancel();
		await second.cancel();
		hub.close();
	});
});
