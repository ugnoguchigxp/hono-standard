import { useEffect, type RefObject } from "react";
import type { BrowserGameRuntimeFactory } from "./browser-game-runtime";

export function useBrowserGameRuntime({
	hostRef,
	createRuntime,
	onStartError,
}: {
	hostRef: RefObject<HTMLElement | null>;
	createRuntime: BrowserGameRuntimeFactory;
	onStartError?: (error: unknown) => void;
}): void {
	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;

		const controller = new AbortController();
		let runtime: ReturnType<BrowserGameRuntimeFactory> | undefined;
		try {
			runtime = createRuntime();
			void Promise.resolve(runtime.start(host, controller.signal)).catch(
				(error: unknown) => {
					if (!controller.signal.aborted) onStartError?.(error);
				},
			);
		} catch (error) {
			onStartError?.(error);
		}

		return () => {
			controller.abort();
			runtime?.dispose();
		};
	}, [createRuntime, hostRef, onStartError]);
}
