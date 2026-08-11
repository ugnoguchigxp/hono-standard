export type BrowserGameViewport = {
	width: number;
	height: number;
	devicePixelRatio: number;
};

export interface BrowserGameRuntime {
	start(host: HTMLElement, signal: AbortSignal): Promise<void> | void;
	resize?(viewport: BrowserGameViewport): void;
	dispose(): void;
}

export type BrowserGameRuntimeFactory = () => BrowserGameRuntime;
