import type {
	BrowserGameRuntime,
	BrowserGameViewport,
} from "../../game-platform";
import type { Action3dRuntimeOptions } from "./types";

export class LazyAction3dRuntime implements BrowserGameRuntime {
	private runtime: BrowserGameRuntime | null = null;
	private disposed = false;
	constructor(private readonly options: Action3dRuntimeOptions) {}
	async start(host: HTMLElement, signal: AbortSignal): Promise<void> {
		const { Action3dGame } = await import("./Action3dGame");
		if (signal.aborted || this.disposed) return;
		this.runtime = new Action3dGame(this.options);
		await this.runtime.start(host, signal);
	}
	resize(viewport: BrowserGameViewport): void {
		this.runtime?.resize?.(viewport);
	}
	dispose(): void {
		this.disposed = true;
		this.runtime?.dispose();
		this.runtime = null;
	}
}
