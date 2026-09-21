import { describe, expect, it } from "vitest";
import { BrainSandboxScheduler } from "./scheduler";
import { BrainSandboxService } from "./service";
describe("BrainSandboxScheduler", () => {
	it("owns one stoppable process timer", async () => {
		const scheduler = new BrainSandboxScheduler(new BrainSandboxService());
		scheduler.start();
		scheduler.start();
		expect(scheduler.isRunning()).toBe(true);
		await scheduler.stop();
		expect(scheduler.isRunning()).toBe(false);
	});
});
