import { useEffect, useState } from "react";
import {
	abortableDelay,
	ObservatoryHttpError,
	runObservatorySession,
} from "./spatial-client";
import type { SpatialData } from "./spatial-state";

export type ConnectionStatus =
	| "loading"
	| "live"
	| "stale"
	| "reconnecting"
	| "offline"
	| "unauthorized";

export function useSpatialData() {
	const [data, setData] = useState<SpatialData | null>(null);
	const [status, setStatus] = useState<ConnectionStatus>("loading");
	const [retryKey, setRetryKey] = useState(0);
	useEffect(() => {
		if (retryKey > 0) setStatus("loading");
		const controller = new AbortController();
		let active = true;
		void (async () => {
			for (
				let attempt = 0;
				attempt < 5 && !controller.signal.aborted;
				attempt += 1
			) {
				if (attempt > 0) setStatus("reconnecting");
				try {
					await runObservatorySession({
						signal: controller.signal,
						onData: (next) => {
							if (active) setData(next);
						},
						onLive: () => {
							if (active) setStatus("live");
						},
					});
					if (controller.signal.aborted) return;
				} catch (error) {
					if (controller.signal.aborted) return;
					if (error instanceof ObservatoryHttpError && error.status === 401) {
						setData(null);
						setStatus("unauthorized");
						return;
					}
					setStatus("stale");
				}
				await abortableDelay(
					Math.min(500 * 2 ** attempt, 5_000),
					controller.signal,
				);
			}
			if (active) setStatus("offline");
		})();
		return () => {
			active = false;
			controller.abort();
		};
	}, [retryKey]);
	return { data, status, retry: () => setRetryKey((key) => key + 1) };
}
