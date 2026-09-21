import { useEffect, useState } from "react";
import { SseParser } from "./sse";
import { fetchWithSession } from "../../api";
export type TelemetryState = {
	snapshot?: Record<string, unknown>;
	error?: string;
	connected: boolean;
};
export function useTelemetry(runId?: string): TelemetryState {
	const [state, setState] = useState<TelemetryState>({ connected: false });
	useEffect(() => {
		if (!runId) {
			setState({ connected: false });
			return;
		}
		const abort = new AbortController();
		let attempt = 0;
		const connect = async () => {
			try {
				const response = await fetchWithSession(
					`/api/experiments/${runId}/events`,
					{
						credentials: "include",
						signal: abort.signal,
					},
				);
				if (!response.ok || !response.body)
					throw new Error(
						response.status === 401
							? "Unauthorized"
							: `Stream failed: ${response.status}`,
					);
				attempt = 0;
				setState((current) => ({
					...current,
					connected: true,
					error: undefined,
				}));
				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				const parser = new SseParser();
				while (!abort.signal.aborted) {
					const { done, value } = await reader.read();
					if (done) break;
					for (const event of parser.push(
						decoder.decode(value, { stream: true }),
					))
						if (event.event === "snapshot" || event.event === "batch")
							setState({
								snapshot: JSON.parse(event.data) as Record<string, unknown>,
								connected: true,
							});
				}
			} catch (error) {
				if (abort.signal.aborted) return;
				const message =
					error instanceof Error ? error.message : "Stream failed";
				setState((current) => ({
					...current,
					connected: false,
					error: message,
				}));
				if (message === "Unauthorized") return;
				attempt++;
				await new Promise((resolve) =>
					setTimeout(resolve, Math.min(10_000, 1_000 * 2 ** (attempt - 1))),
				);
				if (!abort.signal.aborted) void connect();
			}
		};
		void connect();
		return () => abort.abort();
	}, [runId]);
	return state;
}
