import type { BrainSandboxService } from "./service";

/** One process-level cooperative scheduler; it owns no simulation state. */
export class BrainSandboxScheduler {
	private timer: ReturnType<typeof setInterval> | undefined;
	private ticking = false;
	constructor(
		private readonly service: BrainSandboxService,
		private readonly intervalMs = 10,
	) {}
	start(): void {
		if (!this.timer)
			this.timer = setInterval(() => {
				if (this.ticking) return;
				this.ticking = true;
				void this.service.tick().finally(() => {
					this.ticking = false;
				});
			}, this.intervalMs);
		// HTTP server ownership keeps production alive; this timer must not keep CLI tools/tests alive.
		(this.timer as unknown as { unref?: () => void }).unref?.();
	}
	async stop(): Promise<void> {
		if (this.timer) clearInterval(this.timer);
		this.timer = undefined;
	}
	isRunning(): boolean {
		return Boolean(this.timer);
	}
}
